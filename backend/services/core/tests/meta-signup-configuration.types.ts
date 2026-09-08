import {prepareSignupConfiguration, PreparedSignup, SetupContext} from '../src/channels/meta/signup-configuration';
declare const rawRegistryData: unknown;
declare const context: SetupContext;
const result: PreparedSignup = prepareSignupConfiguration(rawRegistryData, context);
const exactCode: 'code' = result.loginOptions.response_type;
const notExecuted: 'not_requested' = result.execution;
void exactCode; void notExecuted;
// @ts-expect-error Snapshot fields are readonly.
result.scope.tenantId = 'cannot-overwrite';
// @ts-expect-error Provider option is not a raw token response.
const secret = result.access_token;
void secret;
// @ts-expect-error Caller may not change prepared options to token response.
result.loginOptions.response_type = 'token';
