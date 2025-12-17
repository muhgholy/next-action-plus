'use client';

import { useState, useTransition } from 'react';

// In a real Next.js app, this would be a relative import like:
// import { sayHello } from '@/app/actions'
import { sayHello } from './nextjs-server-action-for-client';

export function SayHelloClient() {
     const [name, setName] = useState('');
     const [message, setMessage] = useState<string | null>(null);
     const [pending, startTransition] = useTransition();

     return (
          <div>
               <label>
                    Name
                    <input
                         value={name}
                         onChange={e => setName(e.target.value)}
                         placeholder="Ada"
                    />
               </label>
               <button
                    disabled={pending}
                    onClick={() =>
                         startTransition(async () => {
                              const result = await sayHello({ name });
                              setMessage(result.message);
                         })
                    }
               >
                    {pending ? 'Sending…' : 'Say hello'}
               </button>
               {message ? <p>{message}</p> : null}
          </div>
     );
}
