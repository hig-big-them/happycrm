"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Menu, MessageSquare, Settings, BarChart3 } from "lucide-react";
import { createClient } from "../lib/supabase/client";

interface NavbarProps {
  // İsteğe bağlı özellikler ekleyebilirsiniz
}

export function Navbar({}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userRole, loading: isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      // Tam sayfa yönlendirmesi yap
      window.location.href = "/login";
    } catch (error) {
      console.error("Çıkış hatası:", error);
    }
  };

  // Ana navigasyon linkleri - temiz ve düzenli
  const mainNavItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Pipeline", href: "/pipelines" },
    { name: "Müşteri Adayları", href: "/leads" },
    { name: "Mesajlaşma", href: "/messaging", icon: MessageSquare },
  ];

  // Admin menü öğeleri
  const adminNavItems = userRole === "superuser" ? [
    { name: "Yönetim", href: "/admin/agencies" },
    { name: "Ayarlar", href: "/admin/messaging-settings", icon: Settings },
  ] : [];

  // Mobil navigasyon linkleri
  const mobileNavItems = [
    ...mainNavItems,
    ...adminNavItems,
    { name: "Profil", href: "/profile" },
    { name: "Bildirim Ayarları", href: "/notification-settings" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">Happy CRM</span>
          </Link>
          {!isLoading && user && (
            <nav className="hidden md:flex gap-6 items-center">
              {mainNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                    pathname === item.href
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.name}
                </Link>
              ))}
              
              {/* Admin Dropdown */}
              {adminNavItems.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="text-sm font-medium">
                      <Settings className="h-4 w-4 mr-2" />
                      Admin
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Yönetim Paneli</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin/agencies">Ajanslar</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/manage-users">Kullanıcılar</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>WhatsApp</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/whatsapp-templates">Template'ler</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/whatsapp-settings">API Ayarları</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/whatsapp-analytics">Analytics</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin/messaging-settings">Mesaj Ayarları</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {!isLoading && !user ? (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/login">Giriş Yap</Link>
              </Button>
            </div>
          ) : !isLoading && user ? (
            <>
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label="Menüyü Aç"
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader className="mb-4">
                    <SheetTitle>Menü</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-3">
                    {mobileNavItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                          pathname === item.href
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.icon && <item.icon className="h-4 w-4" />}
                        {item.name}
                      </Link>
                    ))}
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      className="justify-start px-2"
                    >
                      Çıkış Yap
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar>
                      <AvatarImage src="" />
                      <AvatarFallback>
                        {user.email?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <p>Hesabım</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/notification-settings">
                      Bildirim Ayarları
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    Çıkış Yap
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
} 