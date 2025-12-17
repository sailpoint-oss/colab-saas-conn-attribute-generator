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
    StdAccountEnableHandler,
    StdAccountDisableHandler,
} from '@sailpoint/connector-sdk'
import { ISCClient } from './isc-client'
import { Config } from './model/config'
import spec from '../connector-spec.json'
import { IdentityDocument, Index, Account as ISCAccount } from 'sailpoint-api-client'
import { processIdentity, StateWrapper } from './utils/attributeProcessing'
import { assert } from './utils/assert'

/**
 * Custom assert function that throws ConnectorError instead of AssertionError
 * @param condition - The condition to check
 * @param message - The error message to throw if condition is falsy
 */

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
    logger.debug(`Found matching source with ID: ${sourceId}`)

    const attributes = config.attributes ?? []
    const uniqueAttributes = attributes.filter((x) => x.type === 'unique' || x.type === 'uuid').map((x) => x.name)
    logger.debug(`Processing ${uniqueAttributes.length} unique attributes`)

    const buildValuesMap = (accounts: ISCAccount[]) => {
        logger.debug(`Processing ${uniqueAttributes.length} unique attributes`)

        const valuesMap = new Map<string, string[]>()
        for (const attribute of uniqueAttributes) {
            const values: string[] = accounts.map((x) => x.attributes?.[attribute]).filter((x) => x)
            valuesMap.set(attribute, values)
            logger.debug(`Collected ${values.length} values for attribute ${attribute}`)
        }

        return valuesMap
    }

    const runChecks = () => {
        logger.debug('Running checks')
        assert(sourceId, 'Source ID not found')
        assert(config.useSearch && config.search !== undefined, 'Search query not found')
        for (const attribute of attributes) {
            if (attribute.type !== 'uuid') {
                assert(attribute.expression, 'Expression is required for non-uuid attributes')
            }
        }
    }

    const stdTestConnection: StdTestConnectionHandler = async (context, input, res) => {
        runChecks()
        logger.debug('Testing connection')
        try {
            await isc.getPublicIdentityConfig()
            for (const attribute of attributes) {
                if (attribute.type !== 'uuid') {
                    assert(attribute.expression, 'Expression is required for non-uuid attributes')
                }
            }
            logger.debug('Connection test successful')
            res.send({})
        } catch (error) {
            logger.error(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountDiscoverSchema: StdAccountDiscoverSchemaHandler = async (context, input, res) => {
        runChecks()
        logger.debug('Discovering account schema')
        const schema: AccountSchema = spec.accountSchema

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
        runChecks()
        logger.debug('Starting account list operation')

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

            const stateWrapper = new StateWrapper(input.state)
            const accountsMap = new Map(accounts.map((x) => [x.identityId!, x]))
            const valuesMap = buildValuesMap(accounts)

            for (const identity of identities) {
                const sourceAccount = accountsMap.get(identity.id)
                const account = await processIdentity(
                    config.attributes,
                    identity,
                    sourceAccount,
                    valuesMap,
                    stateWrapper
                )
                logger.debug(`Sending account with ID: ${account.identity}`)
                res.send(account)
            }

            logger.info('Saving state')
            const stateObject = Object.fromEntries(stateWrapper.state)
            logger.info(`Saving state object: ${JSON.stringify(stateObject)}`)
            res.saveState(stateObject)
        } catch (error) {
            logger.error(`Error in account list operation: ${error instanceof Error ? error.message : String(error)}`)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountRead: StdAccountReadHandler = async (context, input, res) => {
        runChecks()
        logger.debug(`Reading account for identity: ${input.identity}`)
        const identity = await isc.getIdentity(input.identity)
        const account = await processIdentity(attributes, identity)
        logger.debug(`Sending account with ID: ${input.identity}`)
        res.send(account)
    }

    const stdAccountEnable: StdAccountEnableHandler = async (context, input, res) => {
        runChecks()
        const accounts = await isc.listAccountsBySource(sourceId)
        logger.info(`Found ${accounts.length} accounts`)

        //Force attribute refresh
        const refreshAttributes = [...attributes]
        refreshAttributes.forEach((x) => (x.refresh = true))
        const valuesMap = buildValuesMap(accounts)
        logger.debug(`Reading account for identity: ${input.identity}`)
        const sourceAccount = accounts.find((x) => x.nativeIdentity! === input.identity)
        const identity = await isc.getIdentity(input.identity)
        const account = await processIdentity(refreshAttributes, identity, sourceAccount, valuesMap)
        account.disabled = false
        logger.debug(`Sending account with ID: ${input.identity}`)
        res.send(account)
    }

    const stdAccountDisable: StdAccountDisableHandler = async (context, input, res) => {
        runChecks()
        logger.debug(`Reading account for identity: ${input.identity}`)
        const identity = await isc.getIdentity(input.identity)
        const account = await processIdentity(attributes, identity)
        account.disabled = true
        logger.debug(`Sending account with ID: ${input.identity}`)
        res.send(account)
    }

    const stdAccountCreate: StdAccountCreateHandler = async (context, input, res) => {
        runChecks()
        logger.debug(`Creating account for identity: ${input.attributes.name}`)
        const identity = await isc.getIdentityByName(input.attributes.name)
        const account = await processIdentity(attributes, identity)
        account.attributes.actions = 'generate'
        logger.debug(`Sending account with ID: ${account.identity}`)
        res.send(account)
    }

    const stdAccountUpdate: StdAccountUpdateHandler = async (context, input, res) => {
        runChecks()
        logger.debug(`Updating account for identity: ${input.identity}`)

        const identity = await isc.getIdentity(input.identity)
        const account = await processIdentity(attributes, identity)
        for (const change of input.changes) {
            switch (change.op) {
                case AttributeChangeOp.Set:
                    account.attributes[change.attribute] = change.value
                    break
                default:
                    throw new ConnectorError('Only Set operations are supported')
            }
        }

        if (input.changes.find((x) => x.op !== AttributeChangeOp.Set)) {
            throw new ConnectorError('Only Set operations are supported')
        }

        logger.debug(`Sending account with ID: ${account.identity}`)
        res.send(account)
    }

    const stdEntitlementList: StdEntitlementListHandler = async (context, input, res) => {
        runChecks()
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
        .stdAccountEnable(stdAccountEnable)
        .stdAccountDisable(stdAccountDisable)
        .stdAccountCreate(stdAccountCreate)
        .stdAccountUpdate(stdAccountUpdate)
        .stdEntitlementList(stdEntitlementList)
        .stdAccountDiscoverSchema(stdAccountDiscoverSchema)
}
