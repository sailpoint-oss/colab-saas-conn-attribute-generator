import { Attributes, Key, SimpleKey, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { logger } from '@sailpoint/connector-sdk'

export class Account implements StdAccountListOutput {
    disabled?: boolean | undefined
    locked?: boolean | undefined
    deleted?: boolean | undefined
    incomplete?: boolean | undefined
    finalUpdate?: boolean | undefined
    key: Key

    constructor(public attributes: Attributes) {
        logger.debug(`Creating new account with attributes: ${JSON.stringify(attributes)}`)
        this.key = {
            simple: {
                id: attributes.id as string,
            },
        }
        logger.debug(`Generated account key: ${JSON.stringify(this.key)}`)
        this.disabled = false
        logger.debug(`Account created successfully - id: ${attributes.id}`)
    }
}
