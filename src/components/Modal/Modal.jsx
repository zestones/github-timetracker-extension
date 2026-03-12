import { IconX } from '../../icons.jsx';

export function Modal({ title, message, confirmLabel = 'Confirm', confirmVariant = 'primary', onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-[320px] shadow-2xl shadow-black/20 p-5">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
                    <button
                        onClick={onCancel}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-md hover:bg-slate-100 transition-colors"
                    >
                        <IconX size={16} />
                    </button>
                </div>
                <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">{message}</p>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        className="text-[13px] font-medium px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`text-[13px] font-medium px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors text-white ${confirmVariant === 'danger'
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}