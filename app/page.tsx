import Link from "next/link";
import { Mascot } from "@/components/mascot/Mascot";
import { Icon } from "@/components/icons/Icon";

export default function SplashPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-green p-[34px] text-center">
      <div className="mb-1 h-[132px] w-[132px] animate-floaty">
        <Mascot variant="white" mood="cheering" />
      </div>

      <div className="mt-[18px] font-en text-[12.5px] font-bold uppercase tracking-[0.08em] text-green-light">
        Welcome to Akij Resource
      </div>

      <h1 className="my-[10px] font-bn text-[25px] font-bold leading-[1.35] text-white">
        আপনার প্রথম ১৮০ দিনের
        <br />
        সম্পূর্ণ পথচলা
      </h1>

      <p className="mb-[6px] max-w-[300px] text-[14px] font-medium leading-[1.55] text-green-light">
        প্রথম দিন থেকে ১৮০ দিন পর্যন্ত, আমরা আছি আপনার পাশে।
      </p>
      <p className="mb-7 text-[12.5px] font-medium text-[#c7e7d0]">
        Your complete first 180 days journey, guided step by step.
      </p>

      <Link
        href="/login"
        className="flex w-full max-w-[320px] items-center justify-center gap-2 rounded-button
                   bg-white px-4 py-4 font-en text-base font-bold text-green-dark
                   shadow-[0_4px_16px_rgba(0,0,0,.15)] transition-transform active:scale-[0.98]"
      >
        <span>Start My Journey</span>
        <Icon name="arrowRight" size={18} />
      </Link>

      <p className="mt-8 font-en text-xs font-medium text-green-light">
        An Initiative of Akij Resource Human Capital Team
      </p>
    </div>
  );
}
