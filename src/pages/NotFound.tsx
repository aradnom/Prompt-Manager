import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function NotFound() {
  return (
    <main className="container mx-auto p-8 pt-20">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-2/4 border-standard-dark-cyan">
          <CardHeader>
            <CardTitle className="text-4xl">404</CardTitle>
            <CardDescription>Page not found</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-cyan-medium">
              The page you're looking for doesn't exist.
            </p>
            <Link to="/">
              <Button>Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
