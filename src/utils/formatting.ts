import { transliterate } from 'transliteration'
import velocityjs from 'velocityjs'
import { RenderContext } from 'velocityjs/dist/src/type'
import { logger } from '@sailpoint/connector-sdk'
import * as Datefns from 'date-fns'

export const normalize = (str: string): string => {
    let result = transliterate(str)
    result = result.replace(/'/g, '')

    return result
}

export const removeSpaces = (str: string): string => {
    return str.replace(/\s/g, '')
}

export const switchCase = (str: string, caseType: 'lower' | 'upper' | 'capitalize' | 'same'): string => {
    switch (caseType) {
        case 'lower':
            return str.toLowerCase()
        case 'upper':
            return str.toUpperCase()
        case 'capitalize':
            return str
                .split(' ')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
        default:
            return str
    }
}

export const evaluateVelocityTemplate = (
    expression: string,
    context: RenderContext,
    maxLength?: number
): string | undefined => {
    const extendedContext: RenderContext = { ...context, Math, Date, Datefns }
    logger.debug(
        `Evaluating velocity template - expression: ${expression}, context: ${JSON.stringify(extendedContext)}`
    )

    const template = velocityjs.parse(expression)
    const velocity = new velocityjs.Compile(template)
    let result = velocity.render(extendedContext)
    if (maxLength && result.length > maxLength) {
        if (extendedContext.counter && extendedContext.counter !== '') {
            if (expression.endsWith('$counter') || expression.endsWith('${counter}')) {
                const originalCounter = extendedContext.counter
                const originalCounterLength = originalCounter.toString().length
                result = result.substring(0, maxLength - originalCounterLength) + originalCounter
            } else {
                logger.error(
                    `Counter variable is not found at the end of the expression: ${expression}. Cannot truncate the result to the maximum length.`
                )
            }
        } else {
            result = result.substring(0, maxLength)
        }
    }

    logger.debug(`Velocity template evaluation result: ${result}`)
    return result
}

export const templateHasVariable = (expression: string, variable: string): boolean => {
    logger.debug(`Checking if template contains variable: ${variable} in expression: ${expression}`)
    const template = velocityjs.parse(expression)
    const hasVariable = template.find((x) => (x as any).id === variable) ? true : false
    logger.debug(`Template variable check result - variable: ${variable}, found: ${hasVariable}`)
    return hasVariable
}

export const padNumber = (number: number, length: number): string => {
    const numStr = number.toString()
    return numStr.length < length ? numStr.padStart(length, '0') : numStr
}
