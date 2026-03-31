import { connectionService } from '../services/connection-service';

export let doctorRepairArg = '--repair';

export async function detectDoctorRepairArg(): Promise<string> {
  const backend = connectionService.getBackend();
  if (!backend) return doctorRepairArg;

  const result = await backend.exec(['doctor', '--help'], 5000);
  const output = (result.stdout + result.stderr).toLowerCase();

  if (output.includes('--repair')) {
    doctorRepairArg = '--repair';
  } else if (output.includes('--fix')) {
    doctorRepairArg = '--fix';
  } else if (output.includes('-r')) {
    doctorRepairArg = '-r';
  }

  return doctorRepairArg;
}
