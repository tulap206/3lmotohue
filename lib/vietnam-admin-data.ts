export interface AdminArea {
  id: string;
  oldName: string;
  newName: string;
  mergedFrom: string[];
  policeStation: {
    name: string;
    address: string;
    phone?: string;
  };
  coordinates: [number, number]; // [lat, lng]
  region: string;
  level: 'province' | 'ward' | 'commune';
  population?: number;
}

export const vietnamAdminData: AdminArea[] = [
  // Sáp nhập Tuyên Quang + Hà Giang
  {
    id: 'tq-1',
    oldName: 'Hà Giang (tỉnh)',
    newName: 'Tuyên Quang',
    mergedFrom: ['Tuyên Quang', 'Hà Giang'],
    policeStation: {
      name: 'Công an Tỉnh Tuyên Quang',
      address: '12 Tạ Lâm, Phường Tân Quang, TP Tuyên Quang, Tuyên Quang',
      phone: '(0207) 3821 234',
    },
    coordinates: [22.8092, 104.8678],
    region: 'Tuyên Quang',
    level: 'province',
    population: 780000,
  },

  // Sáp nhập Lào Cai + Yên Bái
  {
    id: 'lc-1',
    oldName: 'Yên Bái (tỉnh)',
    newName: 'Lào Cai',
    mergedFrom: ['Lào Cai', 'Yên Bái'],
    policeStation: {
      name: 'Công an Tỉnh Lào Cai',
      address: '2 Hoàng Văn Thụ, Phường I, TP Lào Cai, Lào Cai',
      phone: '(0214) 3820 123',
    },
    coordinates: [22.4843, 103.9653],
    region: 'Lào Cai',
    level: 'province',
    population: 1100000,
  },

  // Sáp nhập Hà Nội - Phường Hoàn Kiếm
  {
    id: 'hn-hk',
    oldName: 'Phường Hoàn Kiếm (cũ)',
    newName: 'Phường Hoàn Kiếm',
    mergedFrom: ['Phường Hoàn Kiếm cũ', 'Phường Hàng Đồng', 'Phường Cửa Đông'],
    policeStation: {
      name: 'Công an Phường Hoàn Kiếm',
      address: '82 Hàng Gai, Phường Hoàn Kiếm, Quận Hoàn Kiếm, Hà Nội',
      phone: '(024) 3825 1234',
    },
    coordinates: [21.0285, 105.8542],
    region: 'Hà Nội',
    level: 'ward',
    population: 105301,
  },

  // Sáp nhập Hà Nội - Phường Cửa Nam
  {
    id: 'hn-cn',
    oldName: 'Phường Cửa Nam (cũ)',
    newName: 'Phường Cửa Nam',
    mergedFrom: ['Phường Cửa Nam cũ', 'Phường Tây Sơn'],
    policeStation: {
      name: 'Công an Phường Cửa Nam',
      address: '75 Nguyễn Huệ, Phường Cửa Nam, Quận Hoàn Kiếm, Hà Nội',
      phone: '(024) 3824 5678',
    },
    coordinates: [21.0310, 105.8498],
    region: 'Hà Nội',
    level: 'ward',
    population: 52751,
  },

  // Sáp nhập Hà Nội - Phường Ba Đình
  {
    id: 'hn-bd',
    oldName: 'Phường Ba Đình (cũ)',
    newName: 'Phường Ba Đình',
    mergedFrom: ['Phường Ba Đình cũ', 'Phường Quốc Tử Giám'],
    policeStation: {
      name: 'Công an Phường Ba Đình',
      address: '12 Pháo Đài Thắng, Phường Ba Đình, Quận Ba Đình, Hà Nội',
      phone: '(024) 3829 0234',
    },
    coordinates: [21.0515, 105.8391],
    region: 'Hà Nội',
    level: 'ward',
    population: 65023,
  },

  // Bắc Ninh - Phường Kinh Bắc
  {
    id: 'bn-kb',
    oldName: 'Phường Kinh Bắc (cũ)',
    newName: 'Phường Kinh Bắc',
    mergedFrom: ['Phường Kinh Bắc cũ', 'Phường Nông Cống'],
    policeStation: {
      name: 'Công an Phường Kinh Bắc',
      address: '45 Trần Hưng Đạo, Phường Kinh Bắc, TP Bắc Ninh, Bắc Ninh',
      phone: '(0222) 3851 456',
    },
    coordinates: [21.1857, 105.9762],
    region: 'Bắc Ninh',
    level: 'ward',
    population: 78943,
  },

  // Bắc Ninh - Phường Võ Cương
  {
    id: 'bn-vc',
    oldName: 'Phường Võ Cương (cũ)',
    newName: 'Phường Võ Cương',
    mergedFrom: ['Phường Võ Cương cũ', 'Phường Yên Phong'],
    policeStation: {
      name: 'Công an Phường Võ Cương',
      address: '88 Nguyễn Trãi, Phường Võ Cương, TP Bắc Ninh, Bắc Ninh',
      phone: '(0222) 3852 789',
    },
    coordinates: [21.1920, 105.9815],
    region: 'Bắc Ninh',
    level: 'ward',
    population: 65230,
  },

  // Quảng Ninh - Thành phố Đông Triều
  {
    id: 'qn-dt',
    oldName: 'TP Đông Triều (cũ)',
    newName: 'Thành phố Đông Triều',
    mergedFrom: ['TP Đông Triều cũ', 'Huyện Cẩm Phả một phần'],
    policeStation: {
      name: 'Công an TP Đông Triều',
      address: '156 Trần Hưng Đạo, Phường An Sinh, TP Đông Triều, Quảng Ninh',
      phone: '(0203) 3869 012',
    },
    coordinates: [20.9618, 106.9715],
    region: 'Quảng Ninh',
    level: 'ward',
    population: 89234,
  },

  // Quảng Ninh - Thành phố Hạ Long
  {
    id: 'qn-hl',
    oldName: 'TP Hạ Long (cũ)',
    newName: 'Thành phố Hạ Long',
    mergedFrom: [
      'TP Hạ Long cũ',
      'Huyện Cát Bà một phần',
      'Huyện Vân Đồn một phần',
    ],
    policeStation: {
      name: 'Công an TP Hạ Long',
      address: '123 Võ Nguyên Giáp, Phường Hạ Long, TP Hạ Long, Quảng Ninh',
      phone: '(0203) 3868 345',
    },
    coordinates: [20.9549, 107.0362],
    region: 'Quảng Ninh',
    level: 'ward',
    population: 156789,
  },

  // Quảng Ninh - Thị trấn Quảng Yên
  {
    id: 'qn-qy',
    oldName: 'Thị trấn Quảng Yên (cũ)',
    newName: 'Thị trấn Quảng Yên',
    mergedFrom: ['Thị trấn Quảng Yên cũ', 'Xã Dương Động'],
    policeStation: {
      name: 'Công an Thị trấn Quảng Yên',
      address: '78 Lê Hồng Phong, Thị trấn Quảng Yên, Quảng Ninh',
      phone: '(0203) 3867 678',
    },
    coordinates: [21.1289, 107.1923],
    region: 'Quảng Ninh',
    level: 'ward',
    population: 42156,
  },

  // TP HCM - Quận 1
  {
    id: 'hcm-1',
    oldName: 'Quận 1 (TP HCM)',
    newName: 'Quận 1',
    mergedFrom: ['Quận 1 cũ'],
    policeStation: {
      name: 'Công an Quận 1',
      address: '69 Ngô Đức Kế, Phường Bến Nghé, Quận 1, TP HCM',
      phone: '(028) 3822 5252',
    },
    coordinates: [10.7769, 106.7017],
    region: 'TP Hồ Chí Minh',
    level: 'ward',
    population: 203451,
  },

  // TP HCM - Quận 2
  {
    id: 'hcm-2',
    oldName: 'Quận 2 (TP HCM)',
    newName: 'Quận 2',
    mergedFrom: ['Quận 2 cũ'],
    policeStation: {
      name: 'Công an Quận 2',
      address: '37 Hoàng Anh, Phường An Phú, Quận 2, TP HCM',
      phone: '(028) 2412 1234',
    },
    coordinates: [10.7818, 106.7654],
    region: 'TP Hồ Chí Minh',
    level: 'ward',
    population: 189234,
  },

  // TP HCM - Quận 3
  {
    id: 'hcm-3',
    oldName: 'Quận 3 (TP HCM)',
    newName: 'Quận 3',
    mergedFrom: ['Quận 3 cũ'],
    policeStation: {
      name: 'Công an Quận 3',
      address: '40 Cao Thắng, Phường 4, Quận 3, TP HCM',
      phone: '(028) 3930 1234',
    },
    coordinates: [10.7748, 106.6906],
    region: 'TP Hồ Chí Minh',
    level: 'ward',
    population: 156789,
  },

  // Cần Thơ - Quận Cần Thơ (sau sáp nhập)
  {
    id: 'ct-1',
    oldName: 'Quận Cần Thơ (cũ)',
    newName: 'Quận Cần Thơ',
    mergedFrom: ['Quận Cần Thơ cũ', 'Huyện Thoại Sơn'],
    policeStation: {
      name: 'Công an Quận Cần Thơ',
      address: '123 Trần Hưng Đạo, Phường Cái Khế, Quận Cần Thơ, TP Cần Thơ',
      phone: '(0292) 2820 1234',
    },
    coordinates: [10.0379, 105.7869],
    region: 'TP Cần Thơ',
    level: 'ward',
    population: 234567,
  },

  // Cần Thơ - Quận Ninh Kiều (sau sáp nhập)
  {
    id: 'ct-2',
    oldName: 'Quận Ninh Kiều (cũ)',
    newName: 'Quận Ninh Kiều',
    mergedFrom: ['Quận Ninh Kiều cũ', 'Huyện Phong Điền'],
    policeStation: {
      name: 'Công an Quận Ninh Kiều',
      address: '456 Phan Đình Phùng, Phường An Khánh, Quận Ninh Kiều, TP Cần Thơ',
      phone: '(0292) 3825 678',
    },
    coordinates: [10.0157, 105.7733],
    region: 'TP Cần Thơ',
    level: 'ward',
    population: 198765,
  },

  // Đà Nẵng - Quận Hải Châu
  {
    id: 'dn-hc',
    oldName: 'Quận Hải Châu (cũ)',
    newName: 'Quận Hải Châu',
    mergedFrom: ['Quận Hải Châu cũ'],
    policeStation: {
      name: 'Công an Quận Hải Châu',
      address: '89 Trần Phú, Phường Hải Châu I, Quận Hải Châu, Đà Nẵng',
      phone: '(0236) 3821 234',
    },
    coordinates: [16.0544, 108.2022],
    region: 'Đà Nẵng',
    level: 'ward',
    population: 145678,
  },

  // Hải Phòng - Quận Hồng Bàng
  {
    id: 'hp-hb',
    oldName: 'Quận Hồng Bàng (cũ)',
    newName: 'Quận Hồng Bàng',
    mergedFrom: ['Quận Hồng Bàng cũ'],
    policeStation: {
      name: 'Công an Quận Hồng Bàng',
      address: '120 Trần Phú, Phường Máy Chai, Quận Hồng Bàng, Hải Phòng',
      phone: '(0225) 3829 012',
    },
    coordinates: [20.8549, 106.6839],
    region: 'Hải Phòng',
    level: 'ward',
    population: 178934,
  },
];

export function searchAdminArea(query: string): AdminArea[] {
  const lowercaseQuery = query.toLowerCase();
  return vietnamAdminData.filter(
    (area) =>
      area.oldName.toLowerCase().includes(lowercaseQuery) ||
      area.newName.toLowerCase().includes(lowercaseQuery) ||
      area.region.toLowerCase().includes(lowercaseQuery)
  );
}

export function getAdminAreaById(id: string): AdminArea | undefined {
  return vietnamAdminData.find((area) => area.id === id);
}
