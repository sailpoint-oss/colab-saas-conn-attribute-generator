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
import { IdentityDocument } from 'sailpoint-api-client'

export class StateWrapper {
    state: Map<string, number> = new Map()

    constructor(state: any) {
        logger.info(`Initializing StateWrapper with state`)
        logger.info(state)
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

    getCounter(key: string): () => number {
        logger.debug(`Getting counter for key: ${key}`)
        return () => {
            const currentValue = this.state.get(key) ?? 1
            this.state.set(key, currentValue + 1)
            logger.debug(`Persistent counter for key ${key} incremented to: ${currentValue + 1}`)
            return currentValue
        }
    }

    initCounter(key: string) {
        if (!this.state.has(key)) {
            this.state.set(key, 1)
        }
    }
}

export const processAttributeDefinition = (
    definition: Attribute,
    attributes: RenderContext,
    counter: () => number,
    values: string[] = []
): string | undefined => {
    let value = evaluateVelocityTemplate(definition.expression, attributes)
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
    counter: () => number,
    values: any[] = []
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
    }

    if (definition.type === 'unique') {
        attributes.counter = ''
    }

    let value = processAttributeDefinition(definition, attributes, counter, values)

    if (definition.type === 'unique') {
        logger.debug(`Processing unique attribute: ${definition.name}`)
        if (!templateHasVariable(definition.expression, 'counter')) {
            logger.debug(`Adding counter variable to expression for unique attribute: ${definition.name}`)
            definition.expression = definition.expression + '$counter'
        }
        while (value && values?.includes(value)) {
            logger.debug(`Value ${value} already exists, generating new value for unique attribute: ${definition.name}`)
            attributes.counter = padNumber(counter(), definition.digits)
            value = processAttributeDefinition(definition, attributes, counter, values)
        }
        values?.push(value)
        logger.debug(`Final unique value generated for attribute ${definition.name}: ${value}`)
    }

    return value
}

export const processAttribute = (
    definition: Attribute,
    identity: IdentityDocument,
    accountAttributes: { [key: string]: any },
    counter: () => number,
    values?: any[]
) => {
    if (definition.type === 'counter' && !counter) {
        logger.info(`Skipping refresh for attribute ${definition.name} because it is of ${definition.type} type`)
        return
    }

    if (definition.type === 'unique' && !values) {
        logger.info(`Skipping refresh for attribute ${definition.name} because it is of ${definition.type} type`)
        return
    }

    let refresh = definition.refresh
    if (refresh || accountAttributes[definition.name] === undefined) {
        logger.debug(`Building attribute ${definition.name} for identity ${identity.id}`)
        if (identity.attributes) {
            const value = buildAttribute(definition, identity.attributes, counter)
            accountAttributes![definition.name] = value
            identity.attributes[definition.name] = value
        } else {
            logger.error(`Identity ${identity.id} has no attributes`)
            throw new ConnectorError(`Identity ${identity.id} has no attributes`)
        }
    }
}
