import {
    createConnector,
    readConfig,
    logger,
    StdTestConnectionHandler,
    ConnectorError,
    StdAccountDiscoverSchemaHandler,
    AccountSchema,
    StdAccountListHandler,
    StdAccountReadHandler,
    StdAccountCreateHandler,
    StdAccountUpdateHandler,
    StdEntitlementListHandler,
    StdEntitlementListOutput,
    AttributeChangeOp,
} from '@sailpoint/connector-sdk'
import { ISCClient } from './isc-client'
import { Config } from './model/config'
import spec from '../connector-spec.json'
import { IdentityDocument, Index } from 'sailpoint-api-client'
import { processIdentity, StateWrapper } from './utils/attributeProcessing'
import assert from 'assert'

// Connector must be exported as module property named connector
export const connector = async () => {
    logger.debug('Initializing connector')
    // Get connector source config
    let config: Config = await readConfig()

    // Use the vendor SDK, or implement own client as necessary, to initialize a client
    const isc = new ISCClient(config)
    logger.debug('Initialized ISC client')
    const sources = await isc.listSources()
    logger.debug(`Retrieved ${sources.length} sources`)
    const source = sources.find(
        (x) => (x as any).connectorAttributes.spConnectorInstanceId === config.spConnectorInstanceId
    )!
    const sourceId = source.id as string
    assert(sourceId, 'Source ID not found')
    logger.debug(`Found matching source with ID: ${sourceId}`)
    assert(config.useSearch && config.search !== undefined, 'Search query not found')

    const stdTestConnection: StdTestConnectionHandler = async (context, input, res) => {
        logger.debug('Testing connection')
        try {
            await isc.getPublicIdentityConfig()
            logger.debug('Connection test successful')
            res.send({})
        } catch (error) {
            logger.error(`Connection test failed: ${error}`)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountDiscoverSchema: StdAccountDiscoverSchemaHandler = async (context, input, res) => {
        logger.debug('Discovering account schema')
        const schema: AccountSchema = spec.accountSchema
        const attributes = config.attributes ?? []

        for (const attribute of attributes) {
            logger.debug(`Adding attribute to schema: ${attribute.name}`)
            schema.attributes.push({
                name: attribute.name,
                type: 'string',
                description: attribute.name,
            })
        }

        logger.debug(`Schema discovery complete with ${schema.attributes.length} attributes`)
        res.send(schema)
    }

    const stdAccountList: StdAccountListHandler = async (context, input, res) => {
        logger.debug('Starting account list operation')
        const attributes = config.attributes ?? []
        const stateWrapper = new StateWrapper(input.state)

        const uniqueAttributes = attributes.filter((x) => x.type === 'unique').map((x) => x.name)
        logger.debug(`Processing ${uniqueAttributes.length} unique attributes`)
        const valuesMap = new Map<string, string[]>()

        try {
            let search = `@accounts(source.id:${sourceId})`
            if (config.useSearch) {
                if (config.keepManuallyGenerated) {
                    search += ` OR ${config.search!.trim()}`
                } else {
                    search = config.search!.trim()
                }
            }
            logger.info(`Using search query: ${search}`)
            const identities = (await isc.search(search, Index.Identities, true)) as IdentityDocument[]
            logger.info(`Found ${identities.length} identities`)
            const accounts = await isc.listAccountsBySource(sourceId)
            logger.info(`Found ${accounts.length} accounts`)
            const accountsMap = new Map(accounts.map((x) => [x.identityId!, x]))

            for (const attribute of uniqueAttributes) {
                const values: string[] = accounts.map((x) => x.attributes?.[attribute]).filter((x) => x)
                valuesMap.set(attribute, values)
                logger.debug(`Collected ${values.length} values for attribute ${attribute}`)
            }

            for (const identity of identities) {
                const sourceAccount = accountsMap.get(identity.id)
                const account = await processIdentity(
                    config.attributes,
                    identity,
                    sourceAccount,
                    stateWrapper,
                    valuesMap
                )
                logger.debug(`Sending account with ID: ${account.identity}`)
                res.send(account)
            }

            logger.info('Saving state')
            const stateObject = Object.fromEntries(stateWrapper.state)
            logger.info(stateObject)
            res.saveState(stateObject)
        } catch (error) {
            logger.error(`Error in account list operation: ${error}`)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountRead: StdAccountReadHandler = async (context, input, res) => {
        logger.debug(`Reading account for identity: ${input.identity}`)
        const identity = await isc.getIdentity(input.identity)
        const account = await processIdentity(config.attributes, identity)
        logger.debug(`Sending account with ID: ${input.identity}`)
        res.send(account)
    }

    const stdAccountCreate: StdAccountCreateHandler = async (context, input, res) => {
        logger.debug(`Creating account for identity: ${input.attributes.name}`)
        const identity = await isc.getIdentityByName(input.attributes.name)
        const account = await processIdentity(config.attributes, identity)
        account.attributes.actions = 'generate'
        logger.debug(`Sending account with ID: ${account.identity}`)
        res.send(account)
    }

    const stdAccountUpdate: StdAccountUpdateHandler = async (context, input, res) => {
        logger.debug(`Updating account for identity: ${input.identity}`)

        for (const change of input.changes) {
            switch (change.op) {
                case AttributeChangeOp.Set:
                    break
                case AttributeChangeOp.Add:
                    break
                case AttributeChangeOp.Remove:
                    break
                default:
                    throw new ConnectorError('Only Set operations are supported')
            }
        }

        if (input.changes.find((x) => x.op !== AttributeChangeOp.Set)) {
            throw new ConnectorError('Only Set operations are supported')
        }

        const identity = await isc.getIdentity(input.identity)
        const account = await processIdentity(config.attributes, identity)
        logger.debug(`Sending account with ID: ${account.identity}`)
        res.send(account)
    }

    const stdEntitlementList: StdEntitlementListHandler = async (context, input, res) => {
        const action: StdEntitlementListOutput = {
            identity: 'generate',
            uuid: 'Generate',
            type: 'action',
            attributes: {
                id: 'generate',
                name: 'Generate',
                description: 'Assign this entitlement to create a new account',
            },
        }

        res.send(action)
    }

    return createConnector()
        .stdTestConnection(stdTestConnection)
        .stdAccountList(stdAccountList)
        .stdAccountRead(stdAccountRead)
        .stdAccountCreate(stdAccountCreate)
        .stdAccountUpdate(stdAccountUpdate)
        .stdEntitlementList(stdEntitlementList)
        .stdAccountDiscoverSchema(stdAccountDiscoverSchema)
}
