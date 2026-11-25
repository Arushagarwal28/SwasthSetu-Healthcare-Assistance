export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-gray-500">
      <span className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-3" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}