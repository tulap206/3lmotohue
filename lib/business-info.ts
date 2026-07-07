/**
 * Thông tin cơ sở kinh doanh 3L MOTO — đồng bộ với trang chủ 3lmotohue.vercel.app
 */
export const QUY79_BUSINESS = {
  brandName: "3L MOTO",
  shopName: "Cửa hàng 3L Moto",
  branches: [
    "L25 Đường Số 8, KQH Đông Nam Thủy An, TP Huế",
  ] as const,
  hotline: "0363.077.775 - 0934.924.195",
  hotlineTel: "0363077775",
  owner: "Dương Phú Lộc",
  representative: "Dương Phú Lộc",
  operators: "Dương Phú Lộc",
  bank: {
    name: "VietinBank",
    accountNumber: "109872584102",
    accountHolder: "PHAN LE TU LAP",
    accountHolderLatin: "PHAN LE TU LAP",
  },
  facebookUrl: "https://www.facebook.com/profile.php?id=100057429789995",
  website: "3lmotohue.vercel.app",
} as const;

export function formatQuy79BankLine(): string {
  const { bank } = QUY79_BUSINESS;
  return `${bank.name} - ${bank.accountNumber}`;
}

export function formatQuy79BankLineFull(): string {
  const { bank } = QUY79_BUSINESS;
  return `${bank.name} - ${bank.accountNumber} - ${bank.accountHolder}`;
}
