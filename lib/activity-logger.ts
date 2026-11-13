/**
 * @deprecated Dùng `logger` từ `@/lib/logger` (có IP/device + Telegram).
 * File này giữ API cũ và ủy quyền sang logger để tránh lệch audit.
 */
import { logger } from "./logger"

export interface ActivityLog {
  username: string
  displayName: string
  action: string
  module: string
  details: string
}

export const logActivity = async (log: ActivityLog) => {
  await logger.log(log.username, log.displayName, log.action, log.module, log.details)
}

export const logLogin = async (username: string, displayName: string) => {
  await logger.login(username, displayName)
}

export const logLogout = async (username: string, displayName: string) => {
  await logger.logout(username, displayName)
}

export const logVehicleAdd = async (
  username: string,
  displayName: string,
  vehicleName: string,
  licensePlate: string
) => {
  await logger.addVehicle(username, displayName, vehicleName, licensePlate)
}

export const logVehicleEdit = async (
  username: string,
  displayName: string,
  vehicleName: string,
  licensePlate: string,
  _changes?: string
) => {
  await logger.editVehicle(username, displayName, vehicleName, licensePlate)
}

export const logVehicleDelete = async (
  username: string,
  displayName: string,
  vehicleName: string,
  licensePlate: string
) => {
  await logger.deleteVehicle(username, displayName, vehicleName, licensePlate)
}

export const logCustomerAdd = async (
  username: string,
  displayName: string,
  name: string,
  phone: string
) => {
  await logger.addCustomer(username, displayName, name, phone)
}

export const logCustomerEdit = async (username: string, displayName: string, name: string) => {
  await logger.editCustomer(username, displayName, name)
}

export const logCustomerDelete = async (username: string, displayName: string, name: string) => {
  await logger.deleteCustomer(username, displayName, name)
}

export const logRentalAdd = async (
  username: string,
  displayName: string,
  customer: string,
  vehicle: string
) => {
  await logger.addRental(username, displayName, customer, vehicle)
}

export const logRentalEdit = async (
  username: string,
  displayName: string,
  customer: string,
  vehicle: string
) => {
  await logger.editRental(username, displayName, customer, vehicle)
}

export const logRentalDelete = async (
  username: string,
  displayName: string,
  customer: string,
  vehicle: string
) => {
  await logger.deleteRental(username, displayName, customer, vehicle)
}

export const logRentalReturn = async (
  username: string,
  displayName: string,
  customer: string,
  vehicle: string
) => {
  await logger.returnRental(username, displayName, customer, vehicle)
}
