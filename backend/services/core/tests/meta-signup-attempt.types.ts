import {AttemptView, Callback, AttemptContext, SignupAttempts} from '../src/channels/meta/signup-attempt';
export function consumer(view: AttemptView, context: AttemptContext, callback: Callback, service: SignupAttempts): void {
  // @ts-expect-error Public observations cannot enable token exchange.
  view.exchange = 'requested';
  // @ts-expect-error Readonly caller binding cannot be rewritten.
  context.epoch = 42;
  // @ts-expect-error A callback must retain its attempt and correlation binding.
  const missing: Callback = {kind:'code',code:'not-a-real-code'};
  void missing; void service; void callback;
}
