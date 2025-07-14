import { Attributes, StdAccountListOutput } from '@sailpoint/connector-sdk'

export class Account implements StdAccountListOutput {
    identity: string
    uuid: string
    disabled?: boolean | undefined
    locked?: boolean | undefined
    deleted?: boolean | undefined
    incomplete?: boolean | undefined
    finalUpdate?: boolean | undefined

    constructor(public attributes: Attributes) {
        this.identity = attributes.id as string
        this.uuid = attributes.name as string
        this.disabled = false
    }
}
