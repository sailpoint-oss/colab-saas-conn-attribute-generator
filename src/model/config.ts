export interface Attribute {
    name: string
    expression?: string
    refresh: boolean
    normalize: boolean
    spaces: boolean
    case: 'same' | 'lower' | 'upper' | 'capitalize'
    type: 'normal' | 'unique' | 'uuid' | 'counter'
    digits: number
    counterStart: number
    maxLength?: number
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
    keepManuallyGenerated?: boolean
}
