import { RenderContext } from 'velocityjs/dist/src/type'
import { Attribute } from '../model/config'
import {
    evaluateVelocityTemplate,
    normalize,
    padNumber,
    removeSpaces,
    switchCase,
    templateHasVariable,
} from './formatting'
import { ConnectorError, logger } from '@sailpoint/connector-sdk'
import { Account as ISCAccount, IdentityDocument } from 'sailpoint-api-client'
import { Account } from '../model/account'
import { v4 as uuidv4 } from 'uuid'

export class StateWrapper {
    state: Map<string, number> = new Map()

    constructor(state?: any) {
        logger.info(`Initializing StateWrapper with state: ${JSON.stringify(state)}`)
        try {
            this.state = new Map(Object.entries(state))
        } catch (e) {
            logger.error('Failed to convert state object to Map. Initializing with empty Map')
        }
    }

    static getCounter(): () => number {
        let counter = 0
        logger.debug('Creating new non-persistent counter')
        return () => {
            counter++
            logger.debug(`Non-persistent counter incremented to: ${counter}`)
            return counter
        }
    }

    getCounter(key: string, start: number = 1): () => number {
        logger.debug(`Getting counter for key: ${key}`)
        return () => {
            const currentValue = this.state.get(key) ?? start
            this.state.set(key, currentValue + 1)
            logger.debug(`Persistent counter for key ${key} incremented to: ${currentValue + 1}`)
            return currentValue
        }
    }

    initCounter(key: string, start: number) {
        if (!this.state.has(key)) {
            this.state.set(key, start)
        }
    }
}

export const processAttributeDefinition = (definition: Attribute, attributes: RenderContext): string | undefined => {
    if (definition.type === 'uuid') {
        return uuidv4()
    }

    let value = evaluateVelocityTemplate(definition.expression!, attributes, definition.maxLength)
    if (value) {
        logger.debug(`Template evaluation result - attributeName: ${definition.name}, rawValue: ${value}`)

        value = switchCase(value, definition.case)
        if (definition.spaces) {
            value = removeSpaces(value)
        }
        if (definition.normalize) {
            value = normalize(value)
        }
        logger.debug(
            `Final attribute value after transformations - attributeName: ${definition.name}, finalValue: ${value}, transformations: case=${definition.case}, spaces=${definition.spaces}, normalize=${definition.normalize}`
        )
    } else {
        logger.error(`Failed to evaluate velocity template for attribute ${definition.name}`)
        return
    }

    return value
}

export const buildAttribute = (
    definition: Attribute,
    attributes: RenderContext,
    values: any[] = [],
    counter?: () => number
): string | undefined => {
    logger.debug(
        `Building attribute: ${definition.name} with definition: ${JSON.stringify(
            definition
        )}, attributes: ${JSON.stringify(attributes)}, values: ${JSON.stringify(values)}`
    )

    if (definition.type === 'counter') {
        if (counter) {
            attributes.counter = padNumber(counter(), definition.digits)
            logger.debug(`Counter value set for attribute ${definition.name}: ${attributes.counter}`)
        } else {
            logger.error(`Counter is required for attribute ${definition.name}`)
            return
        }
    } else {
        attributes.counter = ''
    }

    let value = processAttributeDefinition(definition, attributes)

    if (definition.type === 'unique') {
        logger.debug(`Processing unique attribute: ${definition.name}`)
        if (!templateHasVariable(definition.expression!, 'counter')) {
            logger.debug(`Adding counter variable to expression for unique attribute: ${definition.name}`)
            definition.expression = definition.expression + '$counter'
        }
        while (value && values?.includes(value)) {
            logger.debug(`Value ${value} already exists, generating new value for unique attribute: ${definition.name}`)
            attributes.counter = padNumber(counter!(), definition.digits)
            value = processAttributeDefinition(definition, attributes)
        }
        values?.push(value)
        logger.debug(`Final unique value generated for attribute ${definition.name}: ${value}`)
    } else if (definition.type === 'uuid') {
        while (value && values?.includes(value)) {
            logger.debug(`Value ${value} already exists, generating new value for uuid attribute: ${definition.name}`)
            value = processAttributeDefinition(definition, attributes)
        }
        values?.push(value)
        logger.debug(`Final uuid value generated for attribute ${definition.name}: ${value}`)
    }

    return value
}

export const processAttribute = (
    definition: Attribute,
    identity: IdentityDocument,
    accountAttributes: { [key: string]: any },
    values?: string[],
    counter?: () => number
): void => {
    if (definition.refresh || accountAttributes[definition.name] === undefined) {
        logger.debug(`Building attribute ${definition.name} for identity ${identity.id}`)
        if (identity.attributes) {
            const value = buildAttribute(definition, identity.attributes, values, counter)
            accountAttributes![definition.name] = value
            identity.attributes[definition.name] = value
        } else {
            logger.error(`Identity ${identity.id} has no attributes`)
            throw new ConnectorError(`Identity ${identity.id} has no attributes`)
        }
    }
}

export const processIdentity = (
    attributeDefinitions: Attribute[] | undefined,
    identity: IdentityDocument,
    sourceAccount?: ISCAccount,
    valuesMap?: Map<string, string[]>,
    stateWrapper?: StateWrapper
): Account => {
    const attributes = attributeDefinitions ?? []
    let accountAttributes = sourceAccount?.attributes ?? { id: identity.id, name: identity.name }

    for (const definition of attributes) {
        let counter
        switch (definition.type) {
            case 'counter':
                if (stateWrapper) {
                    counter = stateWrapper?.getCounter(definition.name, definition.counterStart)
                } else {
                    logger.warn(`State wrapper is missing, skipping counter attribute ${definition.name}`)
                    continue
                }
                break
            case 'unique':
                counter = StateWrapper.getCounter()
                break
            default:
                break
        }
        const values = valuesMap?.get(definition.name)

        processAttribute(definition, identity, accountAttributes, values, counter)
    }

    const account = new Account(accountAttributes)

    return account
}
