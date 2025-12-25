import React from 'react';
import { Calculator, DollarSign, Zap } from 'lucide-react';

interface CostWidgetProps {
  inputTokens: number;
  outputTokens: number;
}

export const CostWidget: React.FC<CostWidgetProps> = ({ inputTokens, outputTokens }) => {
  // Pricing assumptions for Gemini Flash Tier (Approximate)
  // Input: $0.075 per 1 million tokens
  // Output: $0.30 per 1 million tokens
  const INPUT_RATE_PER_1M = 0.075;
  const OUTPUT_RATE_PER_1M = 0.30;

  const inputCost = (inputTokens / 1_000_000) * INPUT_RATE_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_RATE_PER_1M;
  const totalCost = inputCost + outputCost;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center space-x-2 mb-3">
        <div className="p-1.5 bg-emerald-100 rounded-md">
           <Calculator className="w-4 h-4 text-emerald-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Est. API Cost</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-50 p-2 rounded border border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Input</div>
            <div className="text-sm font-mono font-medium text-slate-700">{inputTokens.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">tkns</div>
        </div>
        <div className="bg-slate-50 p-2 rounded border border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Output</div>
            <div className="text-sm font-mono font-medium text-slate-700">{outputTokens.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">tkns</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-500 font-medium">Total Spent</span>
        <div className="flex items-center text-emerald-600 font-bold">
            <DollarSign className="w-3 h-3" />
            <span>{totalCost.toFixed(6)}</span>
        </div>
      </div>
      <div className="mt-2 text-[9px] text-slate-400 text-center">
        Based on Flash pricing: $0.075/$0.30 per 1M
      </div>
    </div>
  );
};