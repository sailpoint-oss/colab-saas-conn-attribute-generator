import {
    Account,
    AccountsApi,
    AccountsApiListAccountsRequest,
    Configuration,
    ConfigurationParameters,
    IdentityDocument,
    Index,
    Paginator,
    PublicIdentitiesConfigApi,
    PublicIdentityConfig,
    Search,
    SearchApi,
    SearchDocument,
    SourcesApi,
} from 'sailpoint-api-client'
import { TOKEN_URL_PATH } from './data/constants'
import { Config } from './model/config'

export class ISCClient {
    private config: Configuration

    constructor(config: Config) {
        const conf: ConfigurationParameters = {
            baseurl: config.baseurl,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            tokenUrl: new URL(config.baseurl).origin + TOKEN_URL_PATH,
        }
        this.config = new Configuration(conf)
        this.config.experimental = true
    }

    async getPublicIdentityConfig(): Promise<PublicIdentityConfig> {
        const api = new PublicIdentitiesConfigApi(this.config)

        const response = await api.getPublicIdentityConfig()

        return response.data
    }

    async listSources() {
        const api = new SourcesApi(this.config)

        const response = await Paginator.paginate(api, api.listSources)

        return response.data
    }

    async listAccountsBySource(id: string): Promise<Account[]> {
        const api = new AccountsApi(this.config)
        const filters = `sourceId eq "${id}"`
        const search = async (requestParameters?: AccountsApiListAccountsRequest | undefined) => {
            return await api.listAccounts({ ...requestParameters, filters })
        }

        const response = await Paginator.paginate(api, search)

        return response.data
    }

    async search(query: string, index: Index, includeNested: boolean = true): Promise<SearchDocument[]> {
        const api = new SearchApi(this.config)
        const search: Search = {
            indices: [index],
            query: {
                query,
            },
            sort: ['id'],
            includeNested,
        }

        const response = await Paginator.paginateSearchApi(api, search)
        return response.data as SearchDocument[]
    }

    async getIdentity(id: string): Promise<IdentityDocument> {
        const response = await this.search(`id:${id}`, Index.Identities)

        if (response.length === 0) {
            throw new Error(`Identity not found: ${id}`)
        }

        return response[0] as IdentityDocument
    }

    async getIdentityByName(name: string): Promise<IdentityDocument> {
        const response = await this.search(`name.exact:"${name}"`, Index.Identities)

        if (response.length === 0) {
            throw new Error(`Identity not found: ${name}`)
        }

        return response[0] as IdentityDocument
    }
}
