/**
 * Thông tin cơ sở kinh doanh 3L MOTO — đồng bộ với trang chủ 3lmotohue.vercel.app
 */
export const QUY79_BUSINESS = {
  brandName: "3L MOTO",
  shopName: "Cửa hàng 3L Moto",
  branches: [
    "L25 Đường Số 8, KQH Đông Nam Thủy An, TP Huế",
  ] as const,
  hotline: "0934.924.195 - 0901.995.476",
  hotlineTel: "0934924195",
  owner: "Dương Phú Lộc",
  representative: "Dương Phú Lộc",
  operators: "Dương Phú Lộc",
  bank: {
    name: "SHB",
    accountNumber: "2222629999",
    accountHolder: "PHAN LE TU LAP",
    accountHolderLatin: "PHAN LE TU LAP",
  },
  facebookUrl: "https://www.facebook.com/3l.moto.hue",
  website: "3lmotohue.com",
} as const;

export function formatQuy79BankLine(): string {
  const { bank } = QUY79_BUSINESS;
  return `${bank.name} - ${bank.accountNumber}`;
}

export function formatQuy79BankLineFull(): string {
  const { bank } = QUY79_BUSINESS;
  return `${bank.name} - ${bank.accountNumber} - ${bank.accountHolder}`;
}
