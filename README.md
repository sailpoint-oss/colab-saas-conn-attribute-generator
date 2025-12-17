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

-   Generate custom attributes for identities based on Apache Velocity expressions with enhanced context
-   Access JavaScript Math object, Date object, and date-fns library within Velocity expressions
-   Apply various text transformations (case changes, normalization, space removal)
-   Create unique attributes with automatic conflict resolution using counter digit padding
-   Generate UUID (universally unique identifier) attributes automatically
-   Generate counter-based attributes with configurable digit padding
-   Set maximum length constraints on generated attributes with intelligent truncation
-   Process identities based on search queries
-   Support incremental aggregation with stateful operations
-   Reference previously generated attributes in subsequent attribute definitions
-   Trigger account creation and attribute generation by assigning the "Generate" entitlement to identities
-   Disable and enable accounts with automatic attribute refresh on enable

## Disclaimer

**Important Operational Notes:**

-   **Provisioning Support**: This connector supports account creation through entitlement assignment (the "Generate" entitlement) and account disabling/enabling operations. It does not support traditional provisioning operations like account updates or deletion. It is designed primarily for attribute generation and aggregation.
-   **Aggregation-Based Generation**: Attributes are generated on each account aggregation cycle to ensure consistency and avoid race conditions, particularly when generating unique and counter-based attributes.
-   **On-Demand Generation**: Accounts can also be created on-demand by assigning the "Generate" entitlement to identities, triggering immediate attribute processing.
-   **Account Enable with Force Refresh**: When an account is enabled, all attributes (including unique attributes) are force refreshed and recalculated. This ensures that unique attribute values are regenerated based on the current state of all accounts, preventing conflicts with attributes that may have been assigned to other accounts while the account was disabled.
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

-   **Use Search for Aggregation**: Optional toggle to drive aggregation from an Identity Search query instead of only the connector source. When enabled, the configured search is combined with a source filter so that only identities that both match the query and have accounts on this source are processed.
-   **Identity Search Query**: Filter query to select identities for attribute generation (used when **Use Search for Aggregation** is enabled)
-   **Attribute Generation Definitions**: List of attribute definitions with the following options:
    -   **Attribute Name**: Name of the generated attribute
    -   **Apache Velocity Expression**: Template expression for generating the attribute value
    -   **Case Selection**: Text case transformation (Do not change, Lower case, Upper case, Capitalize)
    -   **Attribute Type**:
        -   **Normal**: Standard attribute generation
        -   **Unique**: Ensures unique values across all identities using counter digit padding for conflicts
        -   **UUID**: Generates universally unique identifiers automatically (no expression required)
        -   **Counter-based**: Generates sequential numbers with configurable digit padding
    -   **Minimum Counter Digits**: Number of digits for counter-based attributes and unique attribute conflict resolution
    -   **Maximum Length**: Optional maximum length for generated attribute values (truncates while preserving counters for unique/counter types)
    -   **Normalize Special Characters**: Remove or replace special characters
    -   **Remove Spaces**: Eliminate spaces from generated values
    -   **Refresh on Each Aggregation**: Regenerate attribute on each connector run
-   **Support for Incremental Counters**: Enable stateful operations so counter-based attributes can keep their sequence across connector runs

![Attribute Generation Configuration](assets/images/Attribute%20Generation%20Configuration.jpg)

![Attribute Definition](assets/images/Attribute%20Definition.jpg)

> **Important**: After adding or modifying attribute definitions, you must re-discover the account schema to update it with the latest changes. This ensures that newly defined attributes are properly recognized by the connector.

## Features

### Velocity Expression Support

Use Apache Velocity templates to generate attribute values based on existing identity attributes. All identity attributes are available as variables (e.g., `$firstname`, `$lastname`, `$email`), and previously generated attributes can be referenced by following attribute definitions.

#### Enhanced Velocity Context

The connector provides an enhanced Velocity context with additional utilities for advanced attribute generation:

-   **Math**: Access to JavaScript Math object for mathematical operations
-   **Date**: JavaScript Date object for date manipulation
-   **Datefns**: Full date-fns library for advanced date formatting and manipulation

#### Basic Examples

```velocity
#set($initial = $firstname.substring(0, 1))$initial$lastname
```

#### Advanced Examples with Enhanced Context

**Using Math operations:**

```velocity
## Generate a random 6-digit number
$Math.floor($Math.random() * 1000000)

## Calculate age-based value
#set($age = 25)
#set($factor = $Math.pow(2, $Math.floor($age / 10)))
Employee-$factor
```

**Using Date operations:**

```velocity
## Generate timestamp-based identifier
user-$Date.now()

## Create date-based username
#set($now = $Date.new())
$firstname.$lastname.$now.getFullYear()
```

**Using Datefns for advanced date formatting:**

```velocity
## Format current date in various ways
#set($now = $Date.new())
user-$Datefns.format($now, "yyyyMMdd")

## Add days to current date
#set($futureDate = $Datefns.addDays($now, 30))
$firstname-$Datefns.format($futureDate, "yyyy-MM-dd")

## Calculate difference between dates
#set($startDate = $Date.new())
#set($endDate = $Datefns.addMonths($startDate, 6))
$Datefns.differenceInDays($endDate, $startDate)
```

### Text Transformations

-   **Case Changes**: Convert to uppercase, lowercase, or capitalize
-   **Normalization**: Remove special characters and accents
-   **Space Removal**: Eliminate spaces from generated values

### Attribute Types

#### Normal Attributes

Standard attribute generation using Velocity expressions.

#### Unique Attributes

Automatically ensures unique values across all identities by appending incremental counters with digit padding when conflicts occur. If the Velocity expression does not already reference a `$counter` variable, the connector will automatically append it for you when resolving conflicts. For example, if "john.doe" already exists, it will generate "john.doe001", "john.doe002", etc.

#### UUID Attributes

Generates universally unique identifiers (UUIDs) automatically using UUID v4 specification. UUID attributes do not require a Velocity expression as they are generated automatically. Each UUID is guaranteed to be unique across all identities. This is ideal for generating unique system identifiers, API keys, or external reference IDs.

**Configuration Note:** When creating a UUID attribute, you can leave the Apache Velocity expression field with any placeholder text (it will be ignored) since UUIDs are generated automatically by the connector.

**Example use cases:**
-   External system integration identifiers
-   API tokens or keys
-   Unique reference numbers
-   System-generated IDs that must be globally unique

**Example Output:** `550e8400-e29b-41d4-a716-446655440000`

#### Counter-based Attributes

Generates sequential numbers with configurable minimum digit padding (e.g., 001, 002, 003).

### Maximum Length

All attribute types (except UUID) support an optional maximum length setting. When configured, the connector will truncate generated values to the specified length:

-   **Normal attributes**: Truncated from the end
-   **Unique attributes**: Truncated while preserving the counter suffix at the end (counter is always placed at the rightmost position within the length limit)
-   **Counter-based attributes**: Truncated while preserving the counter value at the end

**Example:**
If you set a maximum length of 20 characters for a unique attribute:
-   Expression: `$firstname.$lastname`
-   Identity: firstname="Christopher", lastname="Montgomery"
-   Without collision: `Christopher.Montgom` (truncated to 20 chars)
-   With collision: `Christopher.Mont001` (truncated with counter preserved at end)

This feature is particularly useful when integrating with systems that have field length restrictions.

### Attribute Referencing

Attributes are processed in the order they are defined, allowing subsequent attribute definitions to reference previously generated attributes. This enables complex attribute generation workflows where one attribute depends on another.

### Common Use Cases and Examples

#### Generating Time-Based Usernames

```velocity
## Username with year-month
#set($now = $Date.new())
$firstname.$lastname.$Datefns.format($now, "yyyyMM")
## Result: john.doe.202412
```

#### Creating Unique Employee IDs with Date Components

```velocity
## Employee ID with hire date
#set($now = $Date.new())
EMP-$Datefns.format($now, "yyyy")-$counter
## Result: EMP-2024-001, EMP-2024-002, etc.
```

#### Generating Email Addresses with Collision Handling

```velocity
## Email with automatic uniqueness
#set($initial = $firstname.substring(0, 1))
$initial$lastname@company.com
## Result: jdoe@company.com, jdoe001@company.com (if collision)
```

#### Creating License Keys with Random Components

```velocity
## License key with random segment
#set($random = $Math.floor($Math.random() * 10000))
LIC-$Datefns.format($Date.new(), "yyyy")-$random-$counter
## Result: LIC-2024-7342-001
```

#### Formatted Display Names with Length Limits

```velocity
## Display name limited to 20 characters
$firstname $lastname
## With maxLength=20: "Christopher Montgom"
```

#### Generating Expiration Dates

```velocity
## Calculate future expiration date
#set($now = $Date.new())
#set($expiration = $Datefns.addYears($now, 1))
$Datefns.format($expiration, "yyyy-MM-dd")
## Result: 2025-12-03
```

### Stateful Operations

Supports incremental aggregation with persistent counters that maintain state between connector runs. When **Support for Incremental Counters** is enabled in the configuration, the connector saves counter positions between executions so counter-based and unique attributes can continue their sequences without resetting on every aggregation.

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

## Account Management (Disable/Enable)

The connector supports disabling and enabling accounts, providing control over account lifecycle management while ensuring attribute consistency.

### Disabling Accounts

When an account is disabled:

-   The account is marked as disabled in Identity Security Cloud
-   Existing attribute values are preserved
-   The account is excluded from normal operations until re-enabled

### Enabling Accounts

When an account is enabled, the connector performs a **force refresh** of all attributes:

-   **All attributes are recalculated**: Every configured attribute (normal, unique, and counter-based) is regenerated from scratch
-   **Unique attributes are force refreshed**: Unique attributes are recalculated to ensure they don't conflict with values that may have been assigned to other accounts while this account was disabled
-   **Current state consideration**: The regeneration process considers the current state of all accounts in the system, ensuring uniqueness constraints are properly enforced
-   **Account re-activation**: The account is marked as enabled and ready for use

### Use Cases for Disable/Enable

-   **Temporary Account Suspension**: Temporarily disable accounts for users on leave or under investigation
-   **Attribute Conflict Resolution**: Force refresh attributes when conflicts arise or when attribute generation rules change
-   **Account Re-activation**: Safely re-enable accounts with fresh attribute values that comply with current uniqueness constraints
-   **Compliance and Auditing**: Maintain account state while ensuring attributes remain consistent with current generation rules

> **Important**: When enabling an account, be aware that all attribute values will be regenerated. If you need to preserve specific attribute values, consider updating the attribute generation rules or using account update operations before re-enabling.

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

-   **Username Generation**: Create standardized usernames from name components with automatic uniqueness
-   **Email Address Generation**: Generate email addresses based on name patterns with collision resolution
-   **Employee ID Generation**: Create sequential employee IDs with proper formatting and date components
-   **Display Name Creation**: Generate formatted display names from various attributes with length constraints
-   **Unique Identifier Generation**: Create UUIDs or unique identifiers for external system integration
-   **License Key Generation**: Generate license keys with random components and date-based segments
-   **Time-Based Attributes**: Create attributes incorporating timestamps, expiration dates, or hire dates
-   **Mathematical Calculations**: Generate attributes based on calculations (age-based values, percentages, etc.)
-   **Complex Attribute Workflows**: Generate multiple related attributes where one depends on another
-   **System Integration IDs**: Create standardized identifiers with length limits for systems with field restrictions

### Account Creation Scenarios

-   **On-Demand Account Creation**: Create accounts for new identities by assigning the "Generate" entitlement through workflows or manual assignment
-   **Selective Identity Processing**: Generate attributes only for specific identities that require processing, rather than all identities in the system
-   **Workflow-Driven Generation**: Integrate with SailPoint workflows to trigger attribute generation as part of onboarding, role changes, or other business processes
-   **Exception Processing**: Handle identities that may have been missed during regular aggregation cycles
-   **Administrative Tools**: Provide administrators with a simple way to trigger attribute generation for specific users through entitlement assignment

## Dependencies

-   @sailpoint/connector-sdk: ^1.1.35
-   sailpoint-api-client: ^1.7.0
-   transliteration: ^2.3.5
-   velocityjs: ^2.1.5
-   date-fns: ^4.1.0 (provides advanced date formatting and manipulation utilities in Velocity expressions)
-   uuid: ^13.0.0 (provides UUID v4 generation for UUID attribute types)

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
