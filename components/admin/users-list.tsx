import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Users } from 'lucide-react';

interface FeatureModule { id: string; key: string; name: string; description: string; icon: string; }
interface TenantUser {
  id: string; full_name: string; email: string;
  avatar_url: string | null; modules: string[]; role: string; is_active: boolean;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function UsersList({
  tenantUsers, featureModules,
}: { tenantUsers: TenantUser[]; featureModules: FeatureModule[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Usuários da Equipe
        </CardTitle>
        <CardDescription>
          {tenantUsers.length === 0
            ? 'Nenhum usuário associado ainda'
            : `${tenantUsers.length} usuário${tenantUsers.length > 1 ? 's' : ''} na equipe`}
        </CardDescription>
      </CardHeader>
      {tenantUsers.length > 0 && (
        <CardContent>
          <div className="space-y-3">
            {tenantUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-4 rounded-lg border p-3">
                <Avatar className="h-10 w-10">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.full_name} />}
                  <AvatarFallback>{getInitials(u.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.modules.length > 0 ? (
                    u.modules.map((mod) => {
                      const moduleInfo = featureModules.find((fm) => fm.key === mod);
                      return (
                        <Badge key={mod} variant="secondary" className="text-xs">
                          {moduleInfo?.name || mod}
                        </Badge>
                      );
                    })
                  ) : (
                    <Badge variant="outline" className="text-xs">Sem módulos</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
