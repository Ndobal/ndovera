import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

export default function OnboardSchoolModal({ isOpen, setIsOpen }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-slate-100 flex justify-between items-center">
                  Onboard New School
                  <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-slate-800">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </Dialog.Title>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400">School Name</label>
                    <input type="text" className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400">Head of School (HoS) Name</label>
                    <input type="text" className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400">School Initials (3-4 letters)</label>
                    <input type="text" maxLength={4} className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400">Assign Blueprint</label>
                    <select className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200">
                      <option>Basic Blueprint</option>
                      <option>Premium Blueprint</option>
                      <option>International Blueprint</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    onClick={() => setIsOpen(false)}
                  >
                    Onboard School
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
