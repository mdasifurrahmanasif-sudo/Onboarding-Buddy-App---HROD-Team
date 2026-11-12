interface PhoneFrameProps {
  children: React.ReactNode;
}

/**
 * Reproduces the prototype's outer page + .phone/.screen-wrap shell:
 * a centered 430px-wide phone frame with a dark bezel on desktop,
 * full-bleed edge-to-edge on mobile viewports.
 */
export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="phone-page min-h-dvh flex items-center justify-center bg-[#dde1e6] sm:p-6">
      <div
        className="phone-frame relative flex w-full max-w-[430px] transform-gpu flex-col overflow-hidden bg-bg
                   h-dvh sm:h-[850px] sm:max-h-[920px]
                   sm:rounded-[40px] sm:border-[10px] sm:border-[#11151b]
                   sm:shadow-modal"
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">{children}</div>
      </div>
    </div>
  );
}
