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
import { processAttribute, StateWrapper } from './utils/attributeProcessing'
import { Account } from './model/account'

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
    if (!sourceId) {
        throw new ConnectorError('Source ID not found')
    } else {
        logger.debug(`Found matching source with ID: ${sourceId}`)
    }

    const getSourceAccountFromIdentity = (identity: IdentityDocument): { [key: string]: any } => {
        return (
            identity.accounts?.find((x) => x.source?.id === sourceId)?.accountAttributes ?? {
                id: identity.id,
                name: identity.name,
            }
        )
    }

    const processIdentity = async (
        identity: IdentityDocument,
        stateWrapper?: StateWrapper,
        valuesMap?: Map<string, string[]>
    ): Promise<Account> => {
        const attributes = config.attributes ?? []
        let accountAttributes = getSourceAccountFromIdentity(identity)

        for (const definition of attributes) {
            processAttribute(
                definition,
                identity,
                accountAttributes,
                stateWrapper?.getCounter(definition.name) ?? StateWrapper.getCounter(),
                valuesMap?.get(definition.name)
            )
        }

        const account = new Account(accountAttributes)

        return account
    }

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
        config = await readConfig()
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
        config = await readConfig()
        const attributes = config.attributes ?? []
        const stateWrapper = new StateWrapper(input.state)

        const uniqueAttributes = attributes.filter((x) => x.type === 'unique').map((x) => x.name)
        logger.debug(`Processing ${uniqueAttributes.length} unique attributes`)
        const valuesMap = new Map<string, string[]>()

        try {
            let search = ''
            if (config.useSearch) {
                if (config.search) {
                    search = `${config.search.trim()} OR @accounts(source.id:${sourceId})`
                } else {
                    logger.warn('No search query provided, using default search')
                }
            } else {
                search = `@accounts(source.id:${sourceId})`
            }
            const identities = (await isc.search(search, Index.Identities, false)) as IdentityDocument[]
            logger.debug(`Found ${identities.length} identities`)
            const accounts = identities.map(getSourceAccountFromIdentity)

            for (const attribute of uniqueAttributes) {
                const values: string[] = accounts.map((x) => x.attributes?.[attribute]).filter((x) => x)
                valuesMap.set(attribute, values)
                logger.debug(`Collected ${values.length} values for attribute ${attribute}`)
            }

            for (const definition of attributes) {
                logger.debug(`Processing attribute definition: ${definition.name}`)
                if (definition.refresh) {
                    logger.debug(`Refresh flag is set for attribute ${definition.name}.`)

                    if (definition.type === 'counter') {
                        logger.debug(`Resetting counter for attribute ${definition.name}`)
                        stateWrapper.initCounter(definition.name)
                    }

                    if (definition.type === 'unique') {
                        logger.debug(`Resetting values for attribute ${definition.name}`)
                        valuesMap.set(definition.name, [])
                    }
                }

                for (const identity of identities) {
                    const account = await processIdentity(identity, stateWrapper, valuesMap)
                    logger.debug(`Sending account with ID: ${account.identity}`)
                    res.send(account)
                }
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
        config = await readConfig()
        const identity = await isc.getIdentity(input.identity)
        const account = await processIdentity(identity)
        logger.debug(`Sending account with ID: ${input.identity}`)
        res.send(account)
    }

    const stdAccountCreate: StdAccountCreateHandler = async (context, input, res) => {
        logger.debug(`Creating account for identity: ${input.attributes.name}`)
        config = await readConfig()
        const identity = await isc.getIdentityByName(input.attributes.name)
        const account = await processIdentity(identity)
        account.attributes.actions = 'generate'
        logger.debug(`Sending account with ID: ${account.identity}`)
        res.send(account)
    }

    const stdAccountUpdate: StdAccountUpdateHandler = async (context, input, res) => {
        logger.debug(`Updating account for identity: ${input.identity}`)

        if (input.changes.find((x) => x.op !== AttributeChangeOp.Set)) {
            throw new ConnectorError('Only Set operations are supported')
        }

        config = await readConfig()
        const identity = await isc.getIdentity(input.identity)
        const account = await processIdentity(identity)
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
