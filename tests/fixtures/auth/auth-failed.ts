import fixture from './auth-failed.json';

interface AuthFailedMsg {
  isSuccessful: boolean;
  message: string;
}

// Type assertion — tsc --noEmit fails if fixture.msg drifts from AuthFailedMsg.
const _msgCheck: AuthFailedMsg = fixture.msg;
void _msgCheck;
