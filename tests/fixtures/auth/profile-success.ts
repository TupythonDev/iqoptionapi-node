import type { IQRawProfile } from '../../../src/types/profile';
import fixture from './profile-success.json';

// Type assertion — tsc --noEmit fails if fixture.msg drifts from IQRawProfile.
const _msgCheck: IQRawProfile = fixture.msg;
void _msgCheck;
