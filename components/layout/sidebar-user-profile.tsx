'use client';

import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { User } from 'lucide-react';
import { AvailabilityStatusIndicator, type AvailabilityStatus } from './availability-status-indicator';

interface SidebarUserProfileProps {
  userName: string;
  tenantName?: string;
  avatarUrl?: string;
  availabilityStatus?: AvailabilityStatus;
  showAvailability?: boolean;
}

export function SidebarUserProfile({
  userName,
  tenantName,
  avatarUrl,
  availabilityStatus = 'offline',
  showAvailability = false,
}: SidebarUserProfileProps) {
  const router = useRouter();

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-1">
      {showAvailability && (
        <div className="px-2">
          <AvailabilityStatusIndicator status={availabilityStatus} />
        </div>
      )}
      <SidebarMenuButton
        size="lg"
        tooltip={`${userName} - Ver perfil`}
        onClick={() => router.push('/perfil')}
        className="cursor-pointer"
      >
        <Avatar className="h-8 w-8 rounded-lg">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
          <AvatarFallback className="rounded-lg">
            {initials || <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">{userName}</span>
          {tenantName && (
            <span className="truncate text-xs text-muted-foreground">
              {tenantName}
            </span>
          )}
        </div>
      </SidebarMenuButton>
    </div>
  );
}
