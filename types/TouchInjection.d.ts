declare module "TouchInjection" {
  interface TouchInjectionModule {
    checkAccessibilityEnabled(): Promise<boolean>;
    injectTouch(x: number, y: number, action: "down" | "up"): Promise<boolean>;
    injectClick(x: number, y: number): Promise<boolean>;
    injectScroll(
      startX: number,
      startY: number,
      endX: number,
      endY: number
    ): Promise<boolean>;
  }

  const TouchInjection: TouchInjectionModule;
  export default TouchInjection;
}
