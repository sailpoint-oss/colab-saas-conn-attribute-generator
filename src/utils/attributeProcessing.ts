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
import { logger } from '@sailpoint/connector-sdk'

export class StateWrapper {
    constructor(public state: Map<string, number>) {
        logger.debug(`Initializing StateWrapper with state: ${JSON.stringify(Object.fromEntries(state))}`)
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

    getCounter(key: string, persist: boolean = false): () => number {
        logger.debug(`Getting counter for key: ${key}, persist: ${persist}`)
        if (persist) {
            return () => {
                const currentValue = this.state.get(key) ?? 0
                this.state.set(key, currentValue + 1)
                logger.debug(`Persistent counter for key ${key} incremented to: ${currentValue + 1}`)
                return currentValue
            }
        } else {
            return StateWrapper.getCounter()
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

    if (definition.counter) {
        if (counter) {
            attributes.counter = padNumber(counter(), definition.digits)
            logger.debug(`Counter value set for attribute ${definition.name}: ${attributes.counter}`)
        } else {
            logger.error(`Counter is required for attribute ${definition.name}`)
            return
        }
    }

    if (definition.unique) {
        logger.debug(`Processing unique attribute: ${definition.name}`)
        attributes.counter = ''
    }

    let value = processAttributeDefinition(definition, attributes, counter, values)

    if (definition.unique) {
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
