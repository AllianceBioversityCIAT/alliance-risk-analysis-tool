import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InputWithIconProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: LucideIcon;
  iconPosition?: 'left' | 'right';
}

const InputWithIcon = React.forwardRef<HTMLInputElement, InputWithIconProps>(
  ({ icon: Icon, iconPosition = 'left', className, ...props }, ref) => {
    return (
      <div className="relative">
        <Icon
          className={cn(
            'absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none',
            iconPosition === 'left' ? 'left-3' : 'right-3',
          )}
        />
        <Input
          ref={ref}
          className={cn(
            iconPosition === 'left' ? 'pl-9' : 'pr-9',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
InputWithIcon.displayName = 'InputWithIcon';

export { InputWithIcon };
