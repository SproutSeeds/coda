export default function ChoosePathLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Fixed black background to prevent theme color flash */}
      <div className="fixed inset-0 bg-black -z-50" />
      {children}
    </>
  );
}
