# SailPoint Attribute Generator Connector

This connector enables automated generation of custom attributes for identities in SailPoint Identity Security Cloud (ISC) using Apache Velocity expressions and advanced processing options.

## Overview

The Attribute Generator connector allows you to:

-   Generate custom attributes for identities based on Velocity expressions
-   Apply various text transformations (case changes, normalization, space removal)
-   Create unique attributes with automatic conflict resolution using counter digit padding
-   Generate counter-based attributes with configurable digit padding
-   Process identities based on search queries
-   Support incremental aggregation with stateful operations
-   Reference previously generated attributes in subsequent attribute definitions

## Disclaimer

**Important Operational Notes:**

-   **No Provisioning Support**: This connector does not support provisioning operations. It is designed solely for attribute generation and aggregation.
-   **Aggregation-Based Generation**: Attributes are generated on each account aggregation cycle to ensure consistency and avoid race conditions, particularly when generating unique and counter-based attributes.
-   **Stateful Operations**: The connector maintains state between aggregation cycles to ensure proper sequencing of counter-based attributes and unique value generation.

## Prerequisites

-   Node.js (v14 or higher)
-   npm (v6 or higher)
-   SailPoint Identity Security Cloud tenant
-   Personal Access Token (PAT) with appropriate permissions

## Installation

1. Clone this repository

    ```bash
    git clone <repo url>
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Package the connector for deployment:

    ```bash
    npm run pack-zip
    ```

## Configuration

The connector requires the following configuration:

### Connection Details

-   **Identity Security Cloud API URL**: Your ISC tenant's API URL
-   **Personal Access Token ID**: Your PAT ID
-   **Personal Access Token Secret**: Your PAT secret

### Attribute Generation Configuration

-   **Identity Search Query**: Filter query to select identities for attribute generation
-   **Attribute Generation Definitions**: List of attribute definitions with the following options:
    -   **Attribute Name**: Name of the generated attribute
    -   **Apache Velocity Expression**: Template expression for generating the attribute value
    -   **Case Selection**: Text case transformation (Do not change, Lower case, Upper case, Capitalize)
    -   **Attribute Type**:
        -   **Normal**: Standard attribute generation
        -   **Unique**: Ensures unique values across all identities using counter digit padding for conflicts
        -   **Counter-based**: Generates sequential numbers with configurable digit padding
    -   **Minimum Counter Digits**: Number of digits for counter-based attributes and unique attribute conflict resolution
    -   **Normalize Special Characters**: Remove or replace special characters
    -   **Remove Spaces**: Eliminate spaces from generated values
    -   **Refresh on Each Aggregation**: Regenerate attribute on each connector run
-   **Support for Incremental Counters**: Enable stateful operations for persistent counters

![Attribute Generation Configuration](assets/Attribute%20Generation%20Configuration.jpg)

![Attribute Definition](assets/Attribute%20Definition.jpg)

> **Important**: After adding or modifying attribute definitions, you must re-discover the account schema to update it with the latest changes. This ensures that newly defined attributes are properly recognized by the connector.

## Features

### Velocity Expression Support

Use Apache Velocity templates to generate attribute values based on existing identity attributes. All identity attributes are available as variables (e.g., `$firstname`, `$lastname`, `$email`), and previously generated attributes can be referenced by following attribute definitions.

```velocity
#set($initial = $firstname.substring(0, 1))$initial$lastname
```

### Text Transformations

-   **Case Changes**: Convert to uppercase, lowercase, or capitalize
-   **Normalization**: Remove special characters and accents
-   **Space Removal**: Eliminate spaces from generated values

### Attribute Types

#### Normal Attributes

Standard attribute generation using Velocity expressions.

#### Unique Attributes

Automatically ensures unique values across all identities by appending incremental counters with digit padding when conflicts occur. For example, if "john.doe" already exists, it will generate "john.doe001", "john.doe002", etc.

#### Counter-based Attributes

Generates sequential numbers with configurable minimum digit padding (e.g., 001, 002, 003).

### Attribute Referencing

Attributes are processed in the order they are defined, allowing subsequent attribute definitions to reference previously generated attributes. This enables complex attribute generation workflows where one attribute depends on another.

### Stateful Operations

Supports incremental aggregation with persistent counters that maintain state between connector runs.

## Development

### Available Scripts

-   `npm run build` - Build the connector
-   `npm run dev` - Run the connector in development mode
-   `npm run debug` - Run the connector in debug mode
-   `npm run prettier` - Format code using Prettier
-   `npm run pack-zip` - Package the connector for deployment

### Building

To build the connector:

```bash
npm run build
```

### Testing

To test the connection:

```bash
npm run dev
```

## Deployment

1. Build the connector:

```bash
npm run build
```

2. Package the connector:

```bash
npm run pack-zip
```

3. Upload the generated zip file to your SailPoint Identity Security Cloud tenant

## Use Cases

-   **Username Generation**: Create standardized usernames from name components
-   **Email Address Generation**: Generate email addresses based on name patterns
-   **Employee ID Generation**: Create sequential employee IDs with proper formatting
-   **Display Name Creation**: Generate formatted display names from various attributes
-   **Unique Identifier Generation**: Create unique identifiers for external system integration
-   **Complex Attribute Workflows**: Generate multiple related attributes where one depends on another

## Dependencies

-   @sailpoint/connector-sdk: ^1.1.22
-   sailpoint-api-client: ^1.6.0
-   transliteration: ^2.3.5
-   velocityjs: ^2.1.5

## License

This project is private and proprietary.

## Support

For support, please contact your SailPoint representative or open an issue in this repository.
