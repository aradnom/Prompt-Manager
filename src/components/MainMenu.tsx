import { Link, useLocation } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useMenu } from '@/contexts/MenuContext'

export function MainMenu() {
  const { isOpen: open, setIsOpen: setOpen } = useMenu()
  const location = useLocation()
  const { data: config, isLoading } = api.config.getSettings.useQuery()

  type MenuItem = {
    path: string
    label: string
    icon: string
    disabled?: boolean
  }

  const baseMenuItems: MenuItem[] = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/stacks', label: 'Stacks', icon: '📚' },
    { path: '/blocks', label: 'Blocks', icon: '🧱' },
    { path: '/wildcards', label: 'Wildcards', icon: '🎲' },
  ]

  // Only add dev settings if explicitly enabled (not during loading)
  const menuItems = !isLoading && config?.devSettingsEnabled
    ? [
        ...baseMenuItems,
        { path: '/developer-settings', label: 'Developer Settings', icon: '⚙️' },
      ]
    : baseMenuItems

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 inset-y-0 left-0 h-full border-r">
        <SheetHeader>
          <SheetTitle>Prompt Manager</SheetTitle>
          <SheetDescription>
            Navigate your prompt workspace
          </SheetDescription>
        </SheetHeader>
        <nav className="mt-8 flex flex-col gap-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => !item.disabled && setOpen(false)}
              className={`block ${item.disabled ? 'pointer-events-none opacity-50' : ''}`}
            >
              <Button
                variant={isActive(item.path) ? 'default' : 'ghost'}
                className="w-full justify-start"
                disabled={item.disabled}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
                {item.disabled && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Soon
                  </span>
                )}
              </Button>
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
