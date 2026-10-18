"use client";
import { useParams } from "next/navigation";
import { Step1, Step2, Step3, Step4, Step5, Step6 } from "@/components/steps";
import { useProject } from "@/lib/store";

const STEP = { "1": Step1, "2": Step2, "3": Step3, "4": Step4, "5": Step5, "6": Step6 } as const;

export default function SetupStep() {
  const { step } = useParams<{ step: keyof typeof STEP }>();
  const { ready } = useProject();
  const Step = STEP[step] ?? Step1;
  // wait for localStorage so steps don't flash their "go back" state
  return ready ? <Step /> : null;
}
