/* tslint:disable */
/* eslint-disable */
declare module "node-config-ts" {
  interface IConfig {
    analysis: Analysis
    db: Db
    fetch: Fetch
    app: App
  }
  interface App {
    doChecksumCheck: boolean
    port: number
  }
  interface Fetch {
    scheduleUrl: string
    searchUrl: string
  }
  interface Db {
    host: string
    port: number
    password: string
    user: string
    database: string
  }
  interface Analysis {
    ignoreOnlineClasses: boolean
    ignoreGymClasses: boolean
    ignoreDifferentBuildings: boolean
    maxGapLengthHrs: number
    maxRangeOfLessonsPerDay: number
  }
  export const config: Config
  export type Config = IConfig
}
