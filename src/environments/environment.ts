// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  appVersion: '4.0.0',
  appBuild: 1,
  appChannel: 'local',
  apiUrl: 'https://localhost:7013/api',
  androidApiUrl: 'https://10.0.2.2:7013/api',
  googleClientId: '410964984533-5vadg2a2o362vd5ls4ehp116or8soo34.apps.googleusercontent.com',
  googleAndroidClientId: '410964984533-pgunuise95ph74n8b285rso8gsuod0f9.apps.googleusercontent.com',
  accountDeletionUrl: 'https://schoolseclife.azurewebsites.net/cuenta/eliminacion',
  enableDriverTransport: false,
  useMockTransporte: false,
  padreIdusr: 16,
  padreIdmatricula: 37
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
