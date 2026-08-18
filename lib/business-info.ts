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
    name: "BIDV",
    branch: "CN Huế",
    vietQrCode: "BIDV",
    accountNumber: "8839754707",
    accountHolder: "Lê Quốc Lộc",
    accountHolderLatin: "LE QUOC LOC",
  },
  facebookUrl: "https://www.facebook.com/3l.moto.hue",
  website: "3lmotohue.com",
} as const;

export function formatQuy79BankLine(): string {
  const { bank } = QUY79_BUSINESS;
  return `${bank.name} ${bank.branch} - ${bank.accountNumber}`;
}

export function formatQuy79BankLineFull(): string {
  const { bank } = QUY79_BUSINESS;
  return `${bank.name} ${bank.branch} - ${bank.accountNumber} - ${bank.accountHolder}`;
}

export const STATIC_PAYMENT_QR_SRC = "/qr-bidv-le-quoc-loc.png"

/** VietQR động: gắn số tiền + nội dung theo đơn thuê. */
export function getVietQrImageUrl(opts?: { amount?: number; addInfo?: string; template?: "qr_only" | "compact" | "compact2" }) {
  const { bank } = QUY79_BUSINESS
  const template = opts?.template ?? "compact2"
  const params = new URLSearchParams()
  if (opts?.amount && opts.amount > 0) params.set("amount", String(Math.round(opts.amount)))
  if (opts?.addInfo) params.set("addInfo", opts.addInfo.slice(0, 50))
  params.set("accountName", bank.accountHolderLatin)
  return `https://img.vietqr.io/image/${bank.vietQrCode}-${bank.accountNumber}-${template}.png?${params.toString()}`
}

/** Bản quyền phần mềm quản trị 3L Moto */
export const SOFTWARE_ABOUT = {
  productName: "3L Moto",
  productLine: "Phần mềm quản lý vận hành cho thuê xe mô tô",
  author: "Phan Lê Tự Lập",
  email: "phanletulap@gmail.com",
  phone: "0967611112",
  phoneDisplay: "0967 611 112",
} as const
