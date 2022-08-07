/*
 * Created on Wed Feb 17 2021
 *
 * Copyright (c) storycraft. Licensed under the MIT Licence.
 */

import { AuthApiClient, KnownAuthStatusCode } from 'node-kakao';
import * as readline from 'readline';

import {email, pw, deviceName, deviceUUID} from './account.json';

/*
 * Register new sub device to login
 */
const DEVICE_UUID = deviceUUID;
const DEVICE_NAME = deviceName;

const EMAIL = email;
const PASSWORD = pw;

async function main() {
  const form = {
    email: EMAIL,
    password: PASSWORD,

    // This option force login even other devices are logon
    // forced: true,
  };

  const api = await AuthApiClient.create(DEVICE_NAME, DEVICE_UUID);
  const loginRes = await api.login(form);
  console.log(loginRes)
  if (loginRes.success) throw new Error('Device already registered!');
  if (loginRes.status !== KnownAuthStatusCode.DEVICE_NOT_REGISTERED) {
    throw new Error(`Web login failed with status: ${loginRes.status}`);
  }

  const passcodeRes = await api.requestPasscode(form);
  if (!passcodeRes.success) throw new Error(`Passcode request failed with status: ${passcodeRes.status}`);

  const inputInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const passcode = await new Promise<string>((resolve) => inputInterface.question('Enter passcode: ', resolve));
  inputInterface.close();

  // Giving permanent value to false will allow to login only once.
  const registerRes = await api.registerDevice(form, passcode, true);
  if (!registerRes.success) throw new Error(`Device registration failed with status: ${registerRes.status}`);

  console.log(`Device ${DEVICE_UUID} has been registered`);

  // Login after registering devices
  const loginAfterRes = await api.login(form);
  if (!loginAfterRes.success) throw new Error(`Web login failed with status: ${loginAfterRes.status}`);
  console.log(`Client logon successfully`);
}
main().then();