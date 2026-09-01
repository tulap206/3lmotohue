import versionData from "./version.json"

export const APP_VERSION = versionData.version || "2.0.0"
export const APP_AUTHOR_SIGNATURE = `${versionData.author || "@TuLap"} - ${versionData.phone || "0967611112"}`
export const APP_BRAND_VERSION = `${versionData.displayBrand || "3LMoto"} - v${APP_VERSION}`

export default versionData
