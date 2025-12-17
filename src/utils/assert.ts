import { ConnectorError } from '@sailpoint/connector-sdk'

export function assert(condition: any, message: string): asserts condition {
    if (!condition) {
        throw new ConnectorError(message)
    }
}
