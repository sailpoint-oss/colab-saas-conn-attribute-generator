import {
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
import { logger } from '@sailpoint/connector-sdk'

export class ISCClient {
    private config: Configuration

    constructor(config: Config) {
        logger.debug('Initializing ISC client configuration')
        const conf: ConfigurationParameters = {
            baseurl: config.baseurl,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            tokenUrl: new URL(config.baseurl).origin + TOKEN_URL_PATH,
        }
        this.config = new Configuration(conf)
        this.config.experimental = true
        logger.debug('ISC client configuration initialized')
    }

    async getPublicIdentityConfig(): Promise<PublicIdentityConfig> {
        logger.debug('Fetching public identity configuration')
        const api = new PublicIdentitiesConfigApi(this.config)

        const response = await api.getPublicIdentityConfig()
        logger.debug('Successfully retrieved public identity configuration')

        return response.data
    }

    async listSources() {
        logger.debug('Listing sources')
        const api = new SourcesApi(this.config)

        const response = await Paginator.paginate(api, api.listSources)
        logger.debug(`Retrieved ${response.data.length} sources`)

        return response.data
    }

    async search(query: string, index: Index): Promise<SearchDocument[]> {
        logger.debug(`Searching ${index} with query: ${query}`)
        const api = new SearchApi(this.config)
        const search: Search = {
            indices: [index],
            query: {
                query,
            },
            sort: ['id'],
            includeNested: true,
        }

        const response = await Paginator.paginateSearchApi(api, search)
        logger.debug(`Search returned ${response.data.length} results`)
        return response.data as SearchDocument[]
    }

    async getIdentity(id: string): Promise<IdentityDocument> {
        logger.debug(`Fetching identity with ID: ${id}`)
        const response = await this.search(`id:${id}`, Index.Identities)

        if (response.length === 0) {
            logger.error(`No identity found with ID: ${id}`)
            throw new Error(`Identity not found: ${id}`)
        }

        logger.debug(`Successfully retrieved identity: ${id}`)
        return response[0] as IdentityDocument
    }
}
