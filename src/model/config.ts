export interface Attribute {
    name: string
    expression: string
    refresh: boolean
    normalize: boolean
    spaces: boolean
    case: 'same' | 'lower' | 'upper' | 'capitalize'
    counter: boolean
    digits: number
    unique: boolean
}

export interface Config {
    spConnectorInstanceId: string
    spConnectorSpecId: string
    spConnectorSupportsCustomSchemas: boolean
    baseurl: string
    clientId: string
    clientSecret: string
    attributes?: Attribute[]
    counters?: Map<string, number>
    search: string
}
