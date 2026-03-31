import { execCli } from './cli';

export async function checkCliExists(): Promise<boolean> {
  const result = await execCli(['--version'], 5000);
  return result.code === 0;
}

export let doctorRepairArg = '--repair';

export async function detectDoctorRepairArg(): Promise<string> {
  const result = await execCli(['doctor', '--help'], 5000);
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
