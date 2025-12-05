"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Menu, Sparkles, Info, Map, Monitor, Keyboard, MessageSquare, MapPin, Receipt, Settings } from "lucide-react";

import { SignOutButton } from "./SignOutButton";

// Menu item component with glass morphism hover
function MenuItem({
  icon,
  label,
  href,
  onClick,
  danger,
  dataTutorial,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  dataTutorial?: string;
}) {
  const baseClassName = cn(
    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl",
    "text-sm font-medium transition-all duration-200",
    danger
      ? "text-red-400 hover:bg-red-500/10"
      : "text-white/70 hover:text-white hover:bg-white/5"
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={baseClassName}
        data-tutorial={dataTutorial}
      >
        <span className="opacity-60">{icon}</span>
        {label}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={baseClassName}>
      <span className="opacity-60">{icon}</span>
      {label}
    </button>
  );
}

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!menuRef.current || !triggerRef.current) return;
      if (menuRef.current.contains(target) || triggerRef.current.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggle = () => setOpen((value) => !value);

  return (
    <>
      {/* Glass morphism trigger button - fixed top right */}
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "fixed top-6 right-6 z-50",
          "w-10 h-10 rounded-full",
          "bg-white/5 backdrop-blur-md border border-white/10",
          "text-white/60 hover:text-white hover:bg-white/10",
          "transition-all duration-300",
          "flex items-center justify-center",
          open && "bg-white/10 text-white"
        )}
        id="workspace-menu-trigger"
        aria-label="Open workspace menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? <Sparkles className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Dropdown Panel with glass morphism */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-labelledby="workspace-menu-trigger"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "fixed top-18 right-6 z-50",
              "w-64 rounded-2xl overflow-hidden",
              "shadow-2xl shadow-black/50"
            )}
            style={{
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            {/* Header */}
            <div className="px-4 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                  <Sparkles className="size-5 text-white/80" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Coda workspace</p>
                  <p className="text-xs text-white/50">Where ideas go live</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2 space-y-1" role="none">
              <MenuItem
                icon={<Info className="size-4" />}
                label="About Coda"
                href="/about"
                onClick={() => setOpen(false)}
              />
              <MenuItem
                icon={<Map className="size-4" />}
                label="Quest Hub"
                href="/dashboard/quest-hub"
                onClick={() => setOpen(false)}
                dataTutorial="quest-hub-link"
              />
              <MenuItem
                icon={<Monitor className="size-4" />}
                label="Desktop Companion"
                href="/dashboard/devmode/downloads"
                onClick={() => setOpen(false)}
              />
              <MenuItem
                icon={<Keyboard className="size-4" />}
                label="Keyboard shortcuts"
                href="/dashboard/keyboard-shortcuts"
                onClick={() => setOpen(false)}
              />
              <MenuItem
                icon={<MessageSquare className="size-4" />}
                label="Suggestion box"
                href="/dashboard/suggestions"
                onClick={() => setOpen(false)}
              />
              <MenuItem
                icon={<MapPin className="size-4" />}
                label="Meetup check-in"
                href="/check-in"
                onClick={() => setOpen(false)}
              />

              {/* Divider */}
              <div className="my-2 h-px bg-white/10" />

              <MenuItem
                icon={<Receipt className="size-4" />}
                label="Arcane Ledger"
                href="/dashboard/billing"
                onClick={() => setOpen(false)}
              />
              <MenuItem
                icon={<Settings className="size-4" />}
                label="Account settings"
                href="/dashboard/account"
                onClick={() => setOpen(false)}
              />

              {/* Divider */}
              <div className="my-2 h-px bg-white/10" />

              {/* Sign out uses SignOutButton but styled to match */}
              <SignOutButton
                variant="ghost"
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-red-400 hover:bg-red-500/10 hover:text-red-400 border-0"
                role="menuitem"
                onClick={() => setOpen(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
