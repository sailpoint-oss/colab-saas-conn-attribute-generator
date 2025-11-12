export interface Attribute {
    name: string
    expression: string
    refresh: boolean
    normalize: boolean
    spaces: boolean
    case: 'same' | 'lower' | 'upper' | 'capitalize'
    type: 'normal' | 'unique' | 'counter'
    digits: number
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
    search?: string
    useSearch?: boolean
}
