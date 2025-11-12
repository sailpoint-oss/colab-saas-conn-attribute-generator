[![Discourse Topics][discourse-shield]][discourse-url]
[![Issues][issues-shield]][issues-url]
[![Latest Releases][release-shield]][release-url]
[![Contributor Shield][contributor-shield]][contributors-url]

[discourse-shield]: https://img.shields.io/discourse/topics?label=Discuss%20This%20Tool&server=https%3A%2F%2Fdeveloper.sailpoint.com%2Fdiscuss
[discourse-url]: https://developer.sailpoint.com/discuss/tag/workflows
[issues-shield]: https://img.shields.io/github/issues/sailpoint-oss/repo-template?label=Issues
[issues-url]: https://github.com/sailpoint-oss/repo-template/issues
[release-shield]: https://img.shields.io/github/v/release/sailpoint-oss/repo-template?label=Current%20Release
[release-url]: https://github.com/sailpoint-oss/repo-template/releases
[contributor-shield]: https://img.shields.io/github/contributors/sailpoint-oss/repo-template?label=Contributors
[contributors-url]: https://github.com/sailpoint-oss/repo-template/graphs/contributors

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
-   Trigger account creation and attribute generation by assigning the "Generate" entitlement to identities

## Disclaimer

**Important Operational Notes:**

-   **Limited Provisioning Support**: This connector supports account creation only through entitlement assignment (the "Generate" entitlement). It does not support traditional provisioning operations like account updates, disabling, or deletion. It is designed primarily for attribute generation and aggregation.
-   **Aggregation-Based Generation**: Attributes are generated on each account aggregation cycle to ensure consistency and avoid race conditions, particularly when generating unique and counter-based attributes.
-   **On-Demand Generation**: Accounts can also be created on-demand by assigning the "Generate" entitlement to identities, triggering immediate attribute processing.
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

![Attribute Generation Configuration](assets/images/Attribute%20Generation%20Configuration.jpg)

![Attribute Definition](assets/images/Attribute%20Definition.jpg)

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

## Account Creation via Entitlement Assignment

In addition to automatic aggregation-based attribute generation, the connector supports on-demand account creation through entitlement assignment. This provides a flexible way to trigger attribute generation for specific identities when needed.

### The Generate Entitlement

The connector exposes a special entitlement called **"Generate"** that can be assigned to identities to trigger account creation and attribute generation:

-   **Entitlement Name**: Generate
-   **Entitlement Type**: Action
-   **Description**: Assign this entitlement to create a new account

### How Account Creation Works

1. **Entitlement Assignment**: When the "Generate" entitlement is assigned to an identity (either manually or through automated provisioning rules), it triggers the account creation process.

2. **Identity Lookup**: The connector retrieves the full identity details from ISC using the identity name provided in the assignment request.

3. **Attribute Processing**: All configured attribute definitions are processed for the identity, generating the requested attributes based on the defined Velocity expressions and transformation rules.

4. **Account Creation**: A new account is created with the generated attributes and marked with an `actions: 'generate'` attribute to indicate it was created via entitlement assignment.

### Use Cases for Entitlement-Based Creation

-   **On-Demand Generation**: Generate attributes for specific identities without waiting for the next aggregation cycle
-   **Selective Processing**: Create accounts only for identities that require attribute generation, rather than processing all identities
-   **Workflow Integration**: Integrate with SailPoint workflows to trigger attribute generation as part of broader business processes
-   **Manual Processing**: Allow administrators to manually trigger attribute generation for specific users when needed
-   **Exception Handling**: Process identities that may have been skipped during regular aggregation cycles

### Configuration Requirements

To use entitlement-based account creation:

1. Ensure the connector is properly configured with valid ISC API credentials
2. Configure your attribute generation definitions as normal
3. The connector will automatically expose the "Generate" entitlement during entitlement aggregation
4. Assign the "Generate" entitlement to identities either manually through the ISC interface or via automated provisioning policies

> **Note**: Accounts created via entitlement assignment will still respect all configured attribute generation rules, including uniqueness constraints, counter-based attributes, and text transformations.

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

### Attribute Generation Scenarios

-   **Username Generation**: Create standardized usernames from name components
-   **Email Address Generation**: Generate email addresses based on name patterns
-   **Employee ID Generation**: Create sequential employee IDs with proper formatting
-   **Display Name Creation**: Generate formatted display names from various attributes
-   **Unique Identifier Generation**: Create unique identifiers for external system integration
-   **Complex Attribute Workflows**: Generate multiple related attributes where one depends on another

### Account Creation Scenarios

-   **On-Demand Account Creation**: Create accounts for new identities by assigning the "Generate" entitlement through workflows or manual assignment
-   **Selective Identity Processing**: Generate attributes only for specific identities that require processing, rather than all identities in the system
-   **Workflow-Driven Generation**: Integrate with SailPoint workflows to trigger attribute generation as part of onboarding, role changes, or other business processes
-   **Exception Processing**: Handle identities that may have been missed during regular aggregation cycles
-   **Administrative Tools**: Provide administrators with a simple way to trigger attribute generation for specific users through entitlement assignment

## Dependencies

-   @sailpoint/connector-sdk: ^1.1.22
-   sailpoint-api-client: ^1.6.0
-   transliteration: ^2.3.5
-   velocityjs: ^2.1.5

[New to the CoLab? Click here »](https://developer.sailpoint.com/discuss/t/about-the-sailpoint-developer-community-colab/11230)

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag `enhancement`.
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<!-- CONTACT -->

## Discuss

[Click Here](https://developer.sailpoint.com/dicuss/tag/{tagName}) to discuss this tool with other users.
