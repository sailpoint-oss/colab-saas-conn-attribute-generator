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
} from '@sailpoint/connector-sdk'
import { ISCClient } from './isc-client'
import { Config } from './model/config'
import spec from '../connector-spec.json'
import { IdentityDocument, Index } from 'sailpoint-api-client'
import { buildAttribute, StateWrapper } from './utils/attributeProcessing'
import { Account } from './model/account'

// Connector must be exported as module property named connector
export const connector = async () => {
    logger.debug('Initializing connector')
    // Get connector source config
    let config: Config = await readConfig()
    const attributes = config.attributes ?? []
    logger.debug(`Loaded configuration with ${attributes.length} attributes`)

    // Use the vendor SDK, or implement own client as necessary, to initialize a client
    const isc = new ISCClient(config)
    logger.debug('Initialized ISC client')
    const sources = await isc.listSources()
    logger.debug(`Retrieved ${sources.length} sources`)
    const source = sources.find(
        (x) => (x as any).connectorAttributes.spConnectorInstanceId === config.spConnectorInstanceId
    )!
    const sourceId = source.id
    logger.debug(`Found matching source with ID: ${sourceId}`)

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
        const config: Config = await readConfig()
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
        const config: Config = await readConfig()
        const attributes = config.attributes ?? []
        const stateWrapper = new StateWrapper((input.state as Map<string, number>) ?? new Map())

        const uniqueAttributes = attributes.filter((x) => x.unique).map((x) => x.name)
        logger.debug(`Processing ${uniqueAttributes.length} unique attributes`)
        const valuesMap = new Map<string, string[]>()

        try {
            logger.debug(`Searching identities with query: ${config.search}`)
            const identities = (await isc.search(config.search, Index.Identities)) as IdentityDocument[]
            logger.debug(`Found ${identities.length} identities`)
            const accountsMap = new Map(
                identities.map((x) => {
                    return [x.id, x.accounts?.find((y) => y.source?.id === sourceId)?.accountAttributes]
                })
            )
            logger.debug(`Mapped ${accountsMap.size} accounts`)

            for (const attribute of uniqueAttributes) {
                const values = identities.map((x) => x.attributes?.[attribute]).filter((x) => x)
                valuesMap.set(attribute, values)
                logger.debug(`Collected ${values.length} values for attribute ${attribute}`)
            }

            for (const definition of attributes) {
                logger.debug(`Processing attribute definition: ${definition.name}`)
                for (const identity of identities) {
                    let account = accountsMap.get(identity.id)
                    if (definition.refresh || !account || !account[definition.name]) {
                        logger.debug(`Building attribute ${definition.name} for identity ${identity.id}`)
                        if (!account) {
                            account = {
                                id: identity.id,
                                name: identity.name,
                            }
                            accountsMap.set(identity.id, account)
                        }
                        if (identity.attributes) {
                            account![definition.name] = buildAttribute(
                                definition,
                                identity.attributes,
                                stateWrapper.getCounter(definition.name, definition.counter),
                                valuesMap.get(definition.name)
                            )
                        } else {
                            logger.error(`Identity ${identity.id} has no attributes`)
                            throw new ConnectorError(`Identity ${identity.id} has no attributes`)
                        }
                    }
                }
            }

            for (const accountAttributes of accountsMap.values()) {
                if (accountAttributes) {
                    const account = new Account(accountAttributes)
                    logger.debug(`Sending account with ID: ${accountAttributes.id}`)
                    res.send(account)
                }
            }

            logger.debug('Saving state')
            res.saveState(stateWrapper.state)
        } catch (error) {
            logger.error(`Error in account list operation: ${error}`)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountRead: StdAccountReadHandler = async (context, input, res) => {
        logger.debug(`Reading account for identity: ${input.identity}`)
        const config: Config = await readConfig()
        const attributes = config.attributes ?? []
        const identity = await isc.getIdentity(input.identity)
        let accountAttributes = identity.accounts?.find((x) => x.source?.id === sourceId)?.accountAttributes!

        for (const definition of attributes) {
            const refresh = definition.refresh && !definition.unique
            if (refresh || !accountAttributes[definition.name]) {
                logger.debug(`Building attribute ${definition.name} for identity ${identity.id}`)
                if (!accountAttributes) {
                    accountAttributes = {
                        id: identity.id,
                        name: identity.name,
                    }
                }
                if (identity.attributes) {
                    accountAttributes![definition.name] = buildAttribute(
                        definition,
                        identity.attributes,
                        StateWrapper.getCounter()
                    )
                } else {
                    logger.error(`Identity ${identity.id} has no attributes`)
                    throw new ConnectorError(`Identity ${identity.id} has no attributes`)
                }
            }
        }

        const account = new Account(accountAttributes)
        logger.debug(`Sending account with ID: ${accountAttributes.id}`)
        res.send(account)
    }

    logger.debug('Creating connector with handlers')
    return createConnector()
        .stdTestConnection(stdTestConnection)
        .stdAccountList(stdAccountList)
        .stdAccountRead(stdAccountRead)
        .stdAccountDiscoverSchema(stdAccountDiscoverSchema)
}
