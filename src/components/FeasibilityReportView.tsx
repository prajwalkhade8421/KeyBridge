import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { ANDROID_FEASIBILITY_SECTIONS } from '../data/androidStudioProject';

interface FeasibilityReportViewProps {
  isDark: boolean;
}

export const FeasibilityReportView: React.FC<FeasibilityReportViewProps> = ({ isDark }) => {
  const panelBg = isDark
    ? 'bg-[#0F1623] border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const cardBg = isDark
    ? 'bg-[#151E2E] border-slate-800/90'
    : 'bg-slate-50/70 border-slate-200';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <section id="feasibility-section" className="space-y-5">
      <div className={`rounded-2xl border p-5 sm:p-6 space-y-5 ${panelBg}`}>
        <div className="space-y-1.5 max-w-3xl">
          <h2 className="text-lg sm:text-xl font-bold">
            Android Input Policy & Technical Feasibility Analysis
          </h2>
          <p className={`text-xs sm:text-sm leading-relaxed ${mutedText}`}>
            Stock Android separates window-targeted <code className="font-mono text-xs">MotionEvent</code> clicks from global <code className="font-mono text-xs">KeyEvent</code> dispatch. Below is the verified breakdown of what works on unrooted stock Android versus what requires privileged <code className="font-mono text-xs">evdev</code> + <code className="font-mono text-xs">/dev/uinput</code> access.
          </p>
        </div>

        {/* Comparison Matrix Table */}
        <div
          className={`overflow-x-auto rounded-xl border ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b font-semibold ${
                  isDark
                    ? 'bg-[#141D2D] border-slate-800 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <th className="py-3 px-4">Capability / Requirement</th>
                <th className="py-3 px-4">Stock Unrooted (Accessibility + IME)</th>
                <th className="py-3 px-4">USB Host API (UsbDeviceConnection)</th>
                <th className="py-3 px-4">Hybrid Root / Shizuku (evdev + /dev/uinput)</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                isDark ? 'divide-slate-800/70' : 'divide-slate-200'
              }`}
            >
              <tr>
                <td className="py-3 px-4 font-semibold">
                  Configure & Save Without Mouse Connected
                </td>
                <td className="py-3 px-4 text-emerald-400 font-medium">
                  Supported (Jetpack DataStore)
                </td>
                <td className="py-3 px-4 text-emerald-400 font-medium">
                  Supported (Jetpack DataStore)
                </td>
                <td className="py-3 px-4 text-emerald-400 font-medium">
                  Supported (Jetpack DataStore)
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold">
                  Auto-Detect USB OTG & Bluetooth HID Mice
                </td>
                <td className="py-3 px-4 text-emerald-400 font-medium">
                  Supported (InputDeviceListener)
                </td>
                <td className="py-3 px-4 text-amber-400">
                  USB only (No Bluetooth HID support)
                </td>
                <td className="py-3 px-4 text-emerald-400 font-medium">
                  Supported (All USB & Bluetooth HID Mice)
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold">
                  Intercept & Suppress Mouse Back / Forward (Btn 4 & 5)
                </td>
                <td className="py-3 px-4 text-amber-400">
                  Only when mapped to KEYCODE_BACK / FORWARD; bypassed under Pointer Capture
                </td>
                <td className="py-3 px-4 text-red-400">
                  Detaches kernel usbhid driver (kills system mouse pointer)
                </td>
                <td className="py-3 px-4 text-emerald-400 font-medium">
                  100% Suppressed via ioctl(EVIOCGRAB)
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold">
                  Intercept & Suppress Mouse Left, Right, Middle, Btn 6–8
                </td>
                <td className="py-3 px-4 text-red-400">
                  Blocked (MotionEvents do not pass through AccessibilityService)
                </td>
                <td className="py-3 px-4 text-red-400">
                  Kills system cursor; cannot re-inject MotionEvents globally
                </td>
                <td className="py-3 px-4 text-emerald-400 font-medium">
                  100% Suppressed & Replaced via /dev/uinput
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold">
                  Deliver Replacement Key (e.g. Keyboard T) to PojavLauncher
                </td>
                <td className="py-3 px-4 text-amber-400">
                  Text fields only via IME; blocked during 3D Pointer Capture
                </td>
                <td className="py-3 px-4 text-red-400">
                  Blocked (INJECT_EVENTS is signature-only)
                </td>
                <td className="py-3 px-4 text-emerald-400 font-medium">
                  Native Kernel EV_KEY Delivery (Full PojavLauncher Support)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 6-Point Investigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ANDROID_FEASIBILITY_SECTIONS.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${cardBg}`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    {item.number} {item.title}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold shrink-0">
                    {item.verdict === 'Supported Globally' ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Supported
                      </span>
                    ) : item.verdict === 'Partially Supported (Stock Limitations)' ? (
                      <span className="text-amber-400 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Stock Limit
                      </span>
                    ) : (
                      <span className="text-red-400 inline-flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        Stock Blocked
                      </span>
                    )}
                  </span>
                </div>

                <p className="text-xs font-medium leading-relaxed">{item.summary}</p>

                <ul className={`space-y-1.5 text-xs list-disc pl-4 ${mutedText}`}>
                  {item.technicalDetails.map((detail, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={`pt-2.5 border-t text-[11px] font-mono ${
                  isDark
                    ? 'border-slate-800 text-slate-400'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {item.androidApiReferences.join(' · ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
