import * as zustand from "zustand";

const { create } = zustand;

export const useStore = create((set, get) => ({
  // ======================
  // 数据
  // ======================
  cities: [],
  zib: [],
  height: [],

  // ======================
  // UI / 分析状态
  // ======================
  selectedCity: null,
  activeYear: 2016,

  // ======================
  // setters
  // ======================
  setCities: (cities) => set({ cities }),
  setZib: (zib) => set({ zib }),
  setHeight: (height) => set({ height }),

  setActiveYear: (year) => set({ activeYear: year }),

  selectCity: (city) => {
    const { zib, height } = get();

    const years = ["2016", "2023"];

    const paramsByYear = {};

    years.forEach((year) => {
      const zibParams = zib.find(
        d => d.city === city.Name && d.year === year
      );
      const heightParams = height.find(
        d => d.city === city.Name && d.year === year
      );

      paramsByYear[year] = {
        alpha: zibParams?.alpha,
        beta: zibParams?.beta,
        kappa: zibParams?.kappa,
        delta: zibParams?.delta,
        A: heightParams?.A,
        B: heightParams?.B,
        C: heightParams?.C,
        remoteness_range: zibParams?.remoteness_range,
      };
    });

    set({
      selectedCity: {
        ...city,
        params: paramsByYear,
      },
      activeYear: 2016,
    });
  },


  clearSelectedCity: () =>
    set({
      selectedCity: null,
      activeYear: 2016, // ← 这是你想要的行为
    }),

  activeView: "map", // "map" | "parameter"
  setActiveView: (view) => set({ activeView: view }),
}));
